window.App = window.App || {};

App.DIVIDER = '⸻';

// "غير موجود" تعني أن الفرع لا يملك مخزونًا من هذا الموديل إطلاقًا؛ أما إن
// كان هناك مخزون (رصيد > 0) لكن المبيعات صفر، فتُكتب "0" وليس "غير موجود".
// نسخة خلية جدول PDF: سطران بكلمات كاملة، مثل "4 بيع" ثم "(الرصيد 22)" بخط
// أصغر تحته، حفاظًا على وضوح القراءة مع بقاء الجدول في صفحة A4 واحدة عبر
// تصغير الخط والمسافات لهذين السطرين تحديدًا. الأرصدة السالبة تُكتب كما هي
// (بإشارة السالب) دون تعديل، وتُعزل أرقامها بعلامتي اتجاه يونيكود (LRI/PDI)
// كي لا تنقلب إشارة السالب بصريًا داخل خلية بسياق RTL
function branchCellHtml(item, branchKey) {
  var qty = item.branchQty[branchKey];
  var hasQty = qty !== undefined && qty !== null && Math.abs(qty) >= 0.005;
  var balance = item.branchBalance ? item.branchBalance[branchKey] : undefined;
  var hasBalanceData = balance !== undefined && balance !== null;

  if (!hasQty && (!hasBalanceData || balance <= 0.005)) {
    return { html: App.escapeHtml(App.MODEL_NOT_FOUND_LABEL), placeholder: true };
  }

  var qtyIsolated = '⁦' + App.formatInt(hasQty ? qty : 0) + '⁩';
  var html = App.escapeHtml(qtyIsolated + ' بيع');
  if (hasBalanceData) {
    var balIsolated = '⁦' + App.formatInt(balance) + '⁩';
    html += '<br><span class="p-td-balance">' + App.escapeHtml('(الرصيد ' + balIsolated + ')') + '</span>';
  }
  return { html: html, placeholder: false };
}

// نسخة النص القابل للنسخ تعرض دائمًا الكمية المباعة والرصيد المتبقي معًا
// عند توفر بيانات الرصيد، مثل: "الدائري: 6 حبة بيع (الرصيد 9)"، بدل رقم
// واحد فقط، ليعرف القارئ فورًا كمية البيع وما تبقى من مخزون في نفس الفرع
function branchLine(item, branch) {
  var qty = item.branchQty[branch.key];
  var hasQty = qty !== undefined && qty !== null && Math.abs(qty) >= 0.005;
  var balance = item.branchBalance ? item.branchBalance[branch.key] : undefined;
  var hasBalanceData = balance !== undefined && balance !== null;

  var text;
  if (!hasQty && (!hasBalanceData || balance <= 0.005)) {
    text = App.MODEL_NOT_FOUND_LABEL;
  } else if (hasBalanceData) {
    text = App.formatInt(hasQty ? qty : 0) + ' حبة بيع (الرصيد ' + App.formatInt(balance) + ')';
  } else {
    text = App.formatInt(qty) + ' حبة';
  }

  return branch.name + ': ' + text;
}

// يرتّب الفروع لموديل واحد من الأكثر مبيعًا إلى الأقل بحسب الكمية (تفصيل
// الفروع يُعرض دائمًا بالكمية حتى في تقرير مبلغ البيع)، مع بقاء المتساوي
// منها (ومنه غير الموجود) بترتيبه الجغرافي الأصلي كحل افتراضي مستقر
function sortedBranchesForItem(item) {
  return App.BRANCHES.slice().sort(function (a, b) {
    return (item.branchQty[b.key] || 0) - (item.branchQty[a.key] || 0);
  });
}

function buildEntry(item, index, mode) {
  var lines = [];
  lines.push('#' + (index + 1));
  lines.push('');
  lines.push(item.modelCode);
  lines.push(item.modelName || '—');
  lines.push(item.priceLine);
  lines.push(item.supplierName || '—');
  lines.push('');

  if (mode === 'qty') {
    lines.push('إجمالي البيع: ' + App.formatInt(item.totalQty) + ' حبة');
  } else {
    lines.push('إجمالي البيع: ' + App.formatMoney(item.totalSales) + ' ريال');
  }
  lines.push('');
  lines.push(App.DIVIDER);
  lines.push('');

  sortedBranchesForItem(item).forEach(function (b) {
    lines.push(branchLine(item, b));
  });

  return lines.join('\n');
}

App.reportTitle = function (list, mode, dateDisplay) {
  return mode === 'qty'
    ? 'أكثر الموديلات مبيعًا (كمية) ليوم ' + dateDisplay
    : 'أكثر الموديلات نجاحًا ليوم ' + dateDisplay;
};

/**
 * يبني نص التقرير الكامل الجاهز للنسخ (واتساب/تيليجرام)
 * mode: 'qty' أو 'sales'
 */
App.buildReportText = function (list, mode, dateDisplay) {
  var title = App.reportTitle(list, mode, dateDisplay) + ':';

  if (!list || list.length === 0) {
    return title + '\n\nلا توجد بيانات مطابقة لهذا اليوم.';
  }

  var parts = [title, ''];
  list.forEach(function (item, i) {
    parts.push(buildEntry(item, i, mode));
    if (i < list.length - 1) {
      parts.push('');
      parts.push(App.DIVIDER);
      parts.push('');
    }
  });

  return parts.join('\n');
};

App.buildNotesText = function (notes) {
  if (!notes || notes.length === 0) return 'لا توجد ملاحظات على الموديلات الظاهرة في التقريرين.';
  return 'ملاحظات على البيانات:\n\n' + notes.map(function (n) { return '• ' + n; }).join('\n');
};

// ===== نسخة HTML مبسّطة لتصدير PDF (نص فقط، بدون صور، لأصغر حجم ممكن) =====
// جدول واحد مضغوط يجمع كل الموديلات الـ20 في صفحة A4 واحدة (أفقية لاتساع أكبر).

// اسم المورد ينتهي دائمًا بكود/أكواد المورد بين قوسين، مثل "اتش آر ام (0666)".
// هذا الجزء يُعرض بخط أصغر من اسم المورد نفسه لتقليل ثقله البصري والمساحة
// التي يشغلها، مع بقاء الاسم هو العنصر الأبرز في الخلية
function supplierCellHtml(supplierName) {
  if (!supplierName) return App.escapeHtml('—');
  var m = /^(.*?)(\s\([^)]*\))$/.exec(supplierName);
  if (!m) return App.escapeHtml(supplierName);
  return App.escapeHtml(m[1]) + '<span class="p-td-suppliercode">' + App.escapeHtml(m[2]) + '</span>';
}

function buildTableRowHtml(item, index) {
  // عمود "الإجمالي" يعرض دائمًا مجموع الكمية المباعة في كل الفروع (حتى في
  // تقرير مبلغ البيع)، ليطابق وحدة تفصيل الفروع المجاورة له (كمية دائمًا)
  // بدل عرض مبلغ لا يمكن جمعه مباشرةً من الأعمدة الظاهرة
  var totalText = App.formatInt(item.totalQty) + ' حبة';

  // تفصيل الفروع بالكمية دائمًا، حتى في تقرير مبلغ البيع. "غير موجود" فقط
  // عند عدم وجود مخزون؛ صفر مع وجود مخزون يُكتب "0"، ويظهر الرصيد المتبقي
  // (إن توفرت بياناته) في سطر ثانٍ أصغر أسفل الكمية داخل نفس الخلية
  var branchCells = App.BRANCHES.map(function (b) {
    var info = branchCellHtml(item, b.key);
    return '<td class="p-td-num p-td-branch' + (info.placeholder ? ' p-td-empty' : '') + '">' + info.html + '</td>';
  }).join('');

  // عمود السعر ضيق؛ عند اختلاف السعر تُكتب كلمة "مختلفة" كاملة بدل اختصار
  // القائمة/الجملة الطويلة بـ"..."
  var priceCellText = item.priceVaries ? 'مختلفة' : item.priceLine;

  // كود الموديل نص لاتيني/رقمي داخل صف RTL؛ عزله بعلامتي اتجاه يونيكود
  // (LRI/PDI) يضمن نسخ الأحرف بترتيبها الصحيح من عارضات PDF المختلفة، لا
  // مجرد عرضه بصريًا بشكل صحيح
  var isolatedCode = '⁦' + item.modelCode + '⁩';

  return '' +
    '<tr>' +
      '<td class="p-td-rank">' + (index + 1) + '</td>' +
      '<td class="p-td-code">' + App.escapeHtml(isolatedCode) + '</td>' +
      '<td>' + App.escapeHtml(item.modelName || '—') + '</td>' +
      '<td>' + App.escapeHtml(priceCellText) + '</td>' +
      '<td>' + supplierCellHtml(item.supplierName) + '</td>' +
      '<td class="p-td-num p-td-total">' + App.escapeHtml(totalText) + '</td>' +
      branchCells +
    '</tr>';
}

/**
 * يبني HTML مخصّص للطباعة/تصدير PDF (نص خالص، لا صور): جدول واحد يضم كل
 * الموديلات في صفحة A4 واحدة أفقية.
 * mode: 'qty' أو 'sales'
 */
App.buildReportHTML = function (list, mode, dateDisplay) {
  var title = App.reportTitle(list, mode, dateDisplay);
  if (!list || list.length === 0) {
    return '<h1 class="p-title">' + App.escapeHtml(title) + '</h1><p class="p-empty">لا توجد بيانات مطابقة لهذا اليوم.</p>';
  }

  var rows = list.map(function (item, i) { return buildTableRowHtml(item, i); }).join('');
  // في تقرير المبلغ يُضاف "(حبة)" لتوضيح أن عمود الإجمالي وأعمدة الفروع كمية
  // وليست مبلغًا رغم أن التقرير نفسه مرتّب حسب مبلغ البيع. يُغلَّف ضمن span
  // مستقل كي يمكن إخفاؤه بـ CSS في الوضع الطولي المضغوط (50 موديلًا) حيث لا
  // تتسع عناوين الأعمدة الضيقة لهذه الإضافة
  var unitSuffix = mode === 'sales' ? ' <span class="p-th-suffix">(حبة)</span>' : '';
  var branchHeaders = App.BRANCHES.map(function (b) {
    return '<th>' + App.escapeHtml(b.name) + unitSuffix + '</th>';
  }).join('');

  return '' +
    '<h1 class="p-title">' + App.escapeHtml(title) + '</h1>' +
    '<table class="p-table">' +
      '<thead><tr>' +
        '<th class="p-td-rank">#</th><th>الموديل</th><th>البيان</th><th>السعر</th><th>المورد</th>' +
        '<th class="p-td-num">الإجمالي</th>' + branchHeaders +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
};

App.buildNotesHTML = function (notes, dateDisplay) {
  var title = 'ملاحظات على البيانات ليوم ' + dateDisplay;
  if (!notes || notes.length === 0) {
    return '<h1 class="p-title">' + App.escapeHtml(title) + '</h1><p class="p-empty">لا توجد ملاحظات على الموديلات الظاهرة في التقريرين.</p>';
  }
  var items = notes.map(function (n) { return '<li>' + App.escapeHtml(n) + '</li>'; }).join('');
  return '<h1 class="p-title">' + App.escapeHtml(title) + '</h1><ul class="p-notes-list">' + items + '</ul>';
};
