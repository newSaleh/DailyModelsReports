window.App = window.App || {};

/**
 * يحلل مصفوفة صفوف (أول صف = عناوين) ويعيد تقريرين (كمية / مبلغ).
 * المفتاح الأساسي للتجميع هو ModelCode فقط، بغض النظر عن SupplierCode.
 */
App.analyze = function (rows2D, options) {
  options = options || {};
  var selectedDateKey = options.selectedDateKey || null; // 'YYYY-MM-DD'

  if (!rows2D || rows2D.length < 2) {
    return {
      error: 'لا توجد بيانات كافية للتحليل. تأكد من وجود صف عناوين وصف بيانات واحد على الأقل.',
    };
  }

  var headers = rows2D[0];
  var dataRows = rows2D.slice(1).filter(function (r) {
    return r && r.some(function (c) { return c !== undefined && c !== null && String(c).trim() !== ''; });
  });

  var colMap = App.buildFieldColumnMap(headers);
  var branchColMap = App.buildBranchColumnMap(headers);
  var hasWideBranchCols = App.BRANCHES.some(function (b) { return branchColMap[b.key] !== -1; });
  var hasPivotBranch = !hasWideBranchCols && colMap.branchCol !== -1 && colMap.qtyTotal !== -1;
  var hasDateCol = colMap.date !== -1;

  if (colMap.modelCode === -1) {
    return { error: 'تعذّر العثور على عمود "ModelCode" (كود الموديل) في البيانات. تأكد أن صف العناوين موجود ويحتوي على هذا الحقل.' };
  }

  // خريطة التجميع حسب ModelCode (بعد التقليم والتوحيد لحالة الأحرف)
  var models = {}; // key -> aggregate object

  function getAgg(modelKey, displayCode) {
    if (!models[modelKey]) {
      models[modelKey] = {
        modelCode: displayCode,
        totalQty: 0,
        totalSales: 0,
        branchQty: {},
        branchSales: {},
        modelNameCounts: {},
        categoryCounts: {},
        priceCounts: {},
        supplierGroups: {}, // key: اسم المورد (أو كوده إن لم يوجد اسم) -> { qty, codes: {code: true} }
      };
      App.BRANCHES.forEach(function (b) { models[modelKey].branchQty[b.key] = 0; models[modelKey].branchSales[b.key] = 0; });
    }
    return models[modelKey];
  }

  for (var r = 0; r < dataRows.length; r++) {
    var row = dataRows[r];

    var modelCodeRaw = App.trimOrEmpty(row[colMap.modelCode]);
    if (!modelCodeRaw) continue;

    if (hasDateCol && selectedDateKey) {
      var rowDateKey = App.parseDateKey(row[colMap.date]);
      if (rowDateKey === null || rowDateKey !== selectedDateKey) continue;
    }

    var modelKey = modelCodeRaw.toUpperCase();
    var agg = getAgg(modelKey, modelCodeRaw);

    var modelName = colMap.modelName !== -1 ? App.trimOrEmpty(row[colMap.modelName]) : '';
    if (modelName) agg.modelNameCounts[modelName] = (agg.modelNameCounts[modelName] || 0) + 1;

    var category = colMap.category !== -1 ? App.trimOrEmpty(row[colMap.category]) : '';
    if (category) agg.categoryCounts[category] = (agg.categoryCounts[category] || 0) + 1;

    var supplierCode = colMap.supplierCode !== -1 ? App.trimOrEmpty(row[colMap.supplierCode]) : '';
    var supplierName = colMap.supplierName !== -1 ? App.trimOrEmpty(row[colMap.supplierName]) : '';

    var unitPrice = colMap.unitPrice !== -1 ? App.toNumber(row[colMap.unitPrice]) : null;
    if (unitPrice !== null) agg.priceCounts[unitPrice] = (agg.priceCounts[unitPrice] || 0) + 1;

    // ---- تحديد كمية كل فرع لهذا السطر ----
    var rowBranchQty = {};
    var rowQtyTotal = 0;

    if (hasWideBranchCols) {
      App.BRANCHES.forEach(function (b) {
        var idx = branchColMap[b.key];
        var v = idx !== -1 ? App.toNumber(row[idx]) : 0;
        if (v === null) v = 0;
        rowBranchQty[b.key] = v;
        rowQtyTotal += v;
      });
    } else if (hasPivotBranch) {
      var branchText = App.trimOrEmpty(row[colMap.branchCol]);
      var qtyVal = App.toNumber(row[colMap.qtyTotal]);
      if (qtyVal === null) qtyVal = 0;
      rowQtyTotal = qtyVal;
      var matchedKey = App.matchBranchByText(branchText);
      if (matchedKey) rowBranchQty[matchedKey] = qtyVal;
    } else {
      var qtyVal2 = colMap.qtyTotal !== -1 ? App.toNumber(row[colMap.qtyTotal]) : null;
      rowQtyTotal = qtyVal2 === null ? 0 : qtyVal2;
      // لا توجد معلومات فروع لهذا السطر إطلاقًا
    }

    // ---- تحديد مبلغ البيع لهذا السطر ----
    var rowSalesTotal;
    var explicitSales = colMap.salesAmount !== -1 ? App.toNumber(row[colMap.salesAmount]) : null;
    if (explicitSales !== null) {
      rowSalesTotal = explicitSales;
    } else if (unitPrice !== null) {
      rowSalesTotal = rowQtyTotal * unitPrice;
    } else {
      rowSalesTotal = 0;
    }

    var rowBranchSales = {};
    Object.keys(rowBranchQty).forEach(function (k) {
      if (unitPrice !== null) {
        rowBranchSales[k] = rowBranchQty[k] * unitPrice;
      } else if (explicitSales !== null && rowQtyTotal > 0) {
        rowBranchSales[k] = rowSalesTotal * (rowBranchQty[k] / rowQtyTotal);
      } else {
        rowBranchSales[k] = 0;
      }
    });

    // ---- التجميع ----
    agg.totalQty += rowQtyTotal;
    agg.totalSales += rowSalesTotal;
    Object.keys(rowBranchQty).forEach(function (k) {
      agg.branchQty[k] = (agg.branchQty[k] || 0) + rowBranchQty[k];
      agg.branchSales[k] = (agg.branchSales[k] || 0) + rowBranchSales[k];
    });

    // الاسم المختصر من قائمة الأسماء البديلة (حسب كود المورد) له الأولوية؛
    // وإلا يُستخدم اسم المورد كما ورد في البيانات، ثم الكود نفسه كحل أخير
    var supplierAlias = supplierCode ? App.SUPPLIER_ALIASES[App.normalizeSupplierCode(supplierCode)] : undefined;
    var supplierGroupKey = supplierAlias || supplierName || supplierCode;
    if (supplierGroupKey) {
      if (!agg.supplierGroups[supplierGroupKey]) agg.supplierGroups[supplierGroupKey] = { qty: 0, codes: {} };
      agg.supplierGroups[supplierGroupKey].qty += rowQtyTotal;
      if (supplierCode) agg.supplierGroups[supplierGroupKey].codes[supplierCode] = true;
    }
  }

  // ---- بناء القوائم النهائية لكل موديل ----
  var modelKeys = Object.keys(models);
  var finalModels = modelKeys.map(function (key) {
    var agg = models[key];

    // اسم الموديل: الأكثر تكرارًا، وإلا التصنيف كبديل
    var nameEntries = Object.keys(agg.modelNameCounts);
    var displayName = '';
    if (nameEntries.length > 0) {
      nameEntries.sort(function (a, b) { return agg.modelNameCounts[b] - agg.modelNameCounts[a]; });
      displayName = nameEntries[0];
    } else {
      var catEntries = Object.keys(agg.categoryCounts);
      if (catEntries.length > 0) {
        catEntries.sort(function (a, b) { return agg.categoryCounts[b] - agg.categoryCounts[a]; });
        displayName = catEntries[0];
      }
    }

    // السعر
    var prices = Object.keys(agg.priceCounts).map(Number).filter(function (p) { return p > 0; });
    prices.sort(function (a, b) { return a - b; });
    var priceLine;
    if (prices.length === 0) {
      priceLine = 'السعر غير متوفر';
    } else if (prices.length === 1) {
      priceLine = App.formatMoney(prices[0]) + ' ريال';
    } else if (prices.length <= 4) {
      priceLine = 'الأسعار: ' + prices.map(App.formatMoney).join(' / ') + ' ريال';
    } else {
      priceLine = 'السعر غير موحد (' + prices.length + ' أسعار مختلفة)';
    }

    // المورد الأساسي (الأكبر كمية) مع كود/أكواده بين قوسين
    var supplierNames = Object.keys(agg.supplierGroups);
    var supplierName = '';
    if (supplierNames.length > 0) {
      supplierNames.sort(function (a, b) { return agg.supplierGroups[b].qty - agg.supplierGroups[a].qty; });
      var topName = supplierNames[0];
      var codes = Object.keys(agg.supplierGroups[topName].codes).sort();
      supplierName = topName + (codes.length ? ' (' + codes.join('/') + ')' : '');
    }

    return {
      modelCode: agg.modelCode,
      modelName: displayName,
      priceLine: priceLine,
      supplierName: supplierName,
      totalQty: agg.totalQty,
      totalSales: agg.totalSales,
      branchQty: agg.branchQty,
      branchSales: agg.branchSales,
    };
  });

  var qtyList = finalModels.slice().sort(function (a, b) { return b.totalQty - a.totalQty; }).slice(0, 20);
  var salesList = finalModels.slice().sort(function (a, b) { return b.totalSales - a.totalSales; }).slice(0, 20);

  return {
    qtyList: qtyList,
    salesList: salesList,
    totalModels: modelKeys.length,
  };
};
