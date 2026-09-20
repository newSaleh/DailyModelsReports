window.App = window.App || {};

// يحدد جذر مجموعة المورد (عبر supplierGroupRoot) والاسم الأقرب لعرضه، من
// كود/اسم مورد كما وردا في سطر بيانات واحد. مشترك بين App.analyze
// وApp.buildSupplierDirectory حتى يتطابق تعريف "المورد" في الاثنين تمامًا.
App.resolveSupplierGroup = function (supplierCode, supplierName) {
  var normalizedCode = supplierCode ? App.normalizeSupplierCode(supplierCode) : '';
  var root = normalizedCode ? App.supplierGroupRoot(normalizedCode) : (supplierName || '');
  var nameCandidate = App.SUPPLIER_ALIASES[normalizedCode] || supplierName || supplierCode || '';
  return { root: root, nameCandidate: nameCandidate };
};

/**
 * يبني قائمة الموردين المتاحين في البيانات (لتعبئة قائمة الفرز)، مجمّعة حسب
 * نفس منطق دمج الموردين المستخدم في App.analyze (اسم مختصر مشترك أو أزواج
 * أكواد رياض/جدة). كل عنصر: { root, name, codes }.
 */
App.buildSupplierDirectory = function (rows2D) {
  if (!rows2D || rows2D.length < 2) return [];
  var headers = rows2D[0];
  var colMap = App.buildFieldColumnMap(headers);
  if (colMap.supplierCode === -1 && colMap.supplierName === -1) return [];

  var dataRows = rows2D.slice(1);
  var groups = {}; // root -> { nameCount: {name: count}, codes: {code: true} }

  for (var r = 0; r < dataRows.length; r++) {
    var row = dataRows[r];
    var supplierCode = colMap.supplierCode !== -1 ? App.trimOrEmpty(row[colMap.supplierCode]) : '';
    var supplierName = colMap.supplierName !== -1 ? App.trimOrEmpty(row[colMap.supplierName]) : '';
    if (!supplierCode && !supplierName) continue;

    var resolved = App.resolveSupplierGroup(supplierCode, supplierName);
    if (!resolved.root) continue;

    if (!groups[resolved.root]) groups[resolved.root] = { nameCount: {}, codes: {} };
    var g = groups[resolved.root];
    if (supplierCode) g.codes[supplierCode] = true;
    if (resolved.nameCandidate) g.nameCount[resolved.nameCandidate] = (g.nameCount[resolved.nameCandidate] || 0) + 1;
  }

  var list = Object.keys(groups).map(function (root) {
    var g = groups[root];
    var names = Object.keys(g.nameCount).sort(function (a, b) { return g.nameCount[b] - g.nameCount[a]; });
    return { root: root, name: names[0] || root, codes: Object.keys(g.codes).sort() };
  });
  list.sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); });
  return list;
};

/**
 * يحلل مصفوفة صفوف (أول صف = عناوين) ويعيد تقريرين (كمية / مبلغ).
 * المفتاح الأساسي للتجميع هو ModelCode فقط، بغض النظر عن SupplierCode.
 */
App.analyze = function (rows2D, options) {
  options = options || {};
  var selectedDateKey = options.selectedDateKey || null; // 'YYYY-MM-DD'
  var topN = App.toNumber(options.topN);
  if (topN === null || topN < 1) topN = 20;
  topN = Math.floor(topN);

  // فلترة اختيارية حسب مورد واحد أو أكثر (جذور مجموعات كما في buildSupplierDirectory).
  // null/undefined = كل الموردين (بلا فلترة). مصفوفة فارغة = لا مورد محدد
  // عمدًا، فتُرجع النتيجة بلا أي موديلات (وليست معناها "الكل")
  var supplierFilterSet = null;
  if (options.supplierFilter) {
    supplierFilterSet = {};
    options.supplierFilter.forEach(function (root) { supplierFilterSet[root] = true; });
  }

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
  var branchBalanceColMap = App.buildBranchBalanceColumnMap(headers);
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
        branchBalance: {},
        modelNameCounts: {},
        categoryCounts: {},
        priceCounts: {},
        // key: معرّف مجموعة المورد (جذر Union-Find لكود المورد، أو الاسم كحل احتياطي
        // إن لم يوجد كود) -> { qty, codes: {code: true}, nameQty: {name: qty} }
        supplierGroups: {},
      };
      App.BRANCHES.forEach(function (b) { models[modelKey].branchQty[b.key] = 0; models[modelKey].branchBalance[b.key] = 0; });
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

    var supplierCode = colMap.supplierCode !== -1 ? App.trimOrEmpty(row[colMap.supplierCode]) : '';
    var supplierName = colMap.supplierName !== -1 ? App.trimOrEmpty(row[colMap.supplierName]) : '';
    var resolvedSupplier = App.resolveSupplierGroup(supplierCode, supplierName);
    if (supplierFilterSet && !supplierFilterSet[resolvedSupplier.root]) continue;

    var modelKey = modelCodeRaw.toUpperCase();
    var agg = getAgg(modelKey, modelCodeRaw);

    var modelName = colMap.modelName !== -1 ? App.trimOrEmpty(row[colMap.modelName]) : '';
    if (modelName) agg.modelNameCounts[modelName] = (agg.modelNameCounts[modelName] || 0) + 1;

    var category = colMap.category !== -1 ? App.trimOrEmpty(row[colMap.category]) : '';
    if (category) agg.categoryCounts[category] = (agg.categoryCounts[category] || 0) + 1;

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

    // ---- رصيد/مخزون كل فرع لهذا السطر (اختياري، لتمييز "0" عن "غير موجود") ----
    var rowBranchBalance = {};
    App.BRANCHES.forEach(function (b) {
      var balIdx = branchBalanceColMap[b.key];
      if (balIdx === -1) return;
      var bv = App.toNumber(row[balIdx]);
      rowBranchBalance[b.key] = bv === null ? 0 : bv;
    });

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

    // ---- التجميع ----
    agg.totalQty += rowQtyTotal;
    agg.totalSales += rowSalesTotal;
    Object.keys(rowBranchQty).forEach(function (k) {
      agg.branchQty[k] = (agg.branchQty[k] || 0) + rowBranchQty[k];
    });
    Object.keys(rowBranchBalance).forEach(function (k) {
      agg.branchBalance[k] = (agg.branchBalance[k] || 0) + rowBranchBalance[k];
    });

    // مجموعة المورد: كودان لنفس المورد (فرع رياض/جدة، أو أي كودين يتشاركان
    // نفس الاسم المختصر) يُدمجان تحت معرّف مجموعة واحد (resolvedSupplier.root)،
    // بلا اعتماد على تطابق ModelCode لاستنتاج ذلك
    if (resolvedSupplier.root) {
      if (!agg.supplierGroups[resolvedSupplier.root]) agg.supplierGroups[resolvedSupplier.root] = { qty: 0, codes: {}, nameQty: {} };
      var sg = agg.supplierGroups[resolvedSupplier.root];
      sg.qty += rowQtyTotal;
      if (supplierCode) sg.codes[supplierCode] = true;
      if (resolvedSupplier.nameCandidate) sg.nameQty[resolvedSupplier.nameCandidate] = (sg.nameQty[resolvedSupplier.nameCandidate] || 0) + rowQtyTotal;
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
    var priceVaries = prices.length > 1;
    if (prices.length === 0) {
      priceLine = 'السعر غير متوفر';
    } else if (prices.length === 1) {
      priceLine = App.formatMoney(prices[0]) + ' ريال';
    } else if (prices.length <= 4) {
      priceLine = 'الأسعار: ' + prices.map(App.formatMoney).join(' / ') + ' ريال';
    } else {
      priceLine = 'السعر غير موحد (' + prices.length + ' أسعار مختلفة)';
    }

    // المورد الأساسي (مجموعة الأكبر كمية)، واسمه هو الأكثر تكرارًا داخل
    // المجموعة نفسها، مع كل أكوادها بين قوسين
    var groupKeys = Object.keys(agg.supplierGroups);
    var supplierName = '';
    if (groupKeys.length > 0) {
      groupKeys.sort(function (a, b) { return agg.supplierGroups[b].qty - agg.supplierGroups[a].qty; });
      var topGroupRoot = groupKeys[0];
      var topGroup = agg.supplierGroups[topGroupRoot];
      var nameCandidates = Object.keys(topGroup.nameQty);
      nameCandidates.sort(function (a, b) { return topGroup.nameQty[b] - topGroup.nameQty[a]; });
      var topName = nameCandidates[0] || '';

      // للموردين "المزدوجين" (كودان معروفان فأكثر لنفس المورد)، تُعرض كل
      // أكوادهم دائمًا، حتى لو لم يبع أحدها هذا الموديل تحديدًا — بدل
      // الاقتصار على الكود الذي باع هذا الموديل فقط
      var knownCodes = App.supplierGroupAllCodes(topGroupRoot);
      var codes;
      if (knownCodes.length > 1) {
        var seenRawByNormalized = {};
        Object.keys(topGroup.codes).forEach(function (rawCode) {
          seenRawByNormalized[App.normalizeSupplierCode(rawCode)] = rawCode;
        });
        codes = knownCodes.map(function (normCode) {
          return seenRawByNormalized[normCode] || normCode.padStart(4, '0');
        });
      } else {
        codes = Object.keys(topGroup.codes).sort();
      }

      supplierName = topName + (codes.length ? ' (' + codes.join('/') + ')' : '');
    }

    return {
      modelCode: agg.modelCode,
      modelName: displayName,
      priceLine: priceLine,
      priceVaries: priceVaries,
      supplierName: supplierName,
      totalQty: agg.totalQty,
      totalSales: agg.totalSales,
      branchQty: agg.branchQty,
      branchBalance: agg.branchBalance,
    };
  });

  var qtyList = finalModels.slice().sort(function (a, b) { return b.totalQty - a.totalQty; }).slice(0, topN);
  var salesList = finalModels.slice().sort(function (a, b) { return b.totalSales - a.totalSales; }).slice(0, topN);

  // ---- ملاحظات: تُبنى فقط للموديلات الظاهرة فعليًا في التقريرين، لتشرح
  // مباشرة أي شيء غريب يراه المستخدم (سعر غير موحّد، اسم مختلف، كود مرتبط
  // بأكثر من مورد فعليًا) بدل عيّنة عامة من كل قاعدة البيانات
  var visibleKeys = {};
  qtyList.concat(salesList).forEach(function (m) { visibleKeys[m.modelCode.toUpperCase()] = true; });

  var notes = [];
  notes.push('إجمالي السجلات المقروءة: ' + App.formatInt(dataRows.length) + ' — عدد الموديلات بعد الدمج: ' + App.formatInt(modelKeys.length) + '.');

  Object.keys(visibleKeys).sort().forEach(function (key) {
    var agg = models[key];
    var flags = [];

    var prices = Object.keys(agg.priceCounts).map(Number).filter(function (p) { return p > 0; }).sort(function (a, b) { return a - b; });
    if (prices.length > 1) {
      flags.push('اختلاف السعر (' + prices.length + ' سعر مختلف): ' + prices.map(App.formatMoney).join(' / ') + ' ريال — غالبًا بسبب اختلاف المقاس/اللون بين قطع الموديل نفسه.');
    }

    var names = Object.keys(agg.modelNameCounts);
    if (names.length > 1) {
      flags.push('اختلاف اسم الموديل بين السجلات: ' + names.join(' / ') + '.');
    }

    var groupKeys = Object.keys(agg.supplierGroups);
    if (groupKeys.length > 1) {
      var groupDescriptions = groupKeys.map(function (gk) {
        var g = agg.supplierGroups[gk];
        var nameCands = Object.keys(g.nameQty).sort(function (a, b) { return g.nameQty[b] - g.nameQty[a]; });
        var codes = Object.keys(g.codes).sort();
        return (nameCands[0] || '؟') + (codes.length ? ' (' + codes.join('/') + ')' : '');
      });
      flags.push('هذا الكود مرتبط بأكثر من مورد مختلف فعليًا، فقد يكون هذا تشابهًا صدفة في رقم الموديل بين منتجات مختلفة: ' + groupDescriptions.join('، ') + '.');
    }

    if (flags.length > 0) {
      notes.push(agg.modelCode + ' — ' + flags.join(' '));
    }
  });

  return {
    qtyList: qtyList,
    salesList: salesList,
    notes: notes,
    totalModels: modelKeys.length,
  };
};
