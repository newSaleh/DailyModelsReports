window.App = window.App || {};

App.DIVIDER = '⸻';

function branchLine(branch, value, unit, formatter) {
  var text = (value === undefined || value === null || Math.abs(value) < 0.005)
    ? App.MODEL_NOT_FOUND_LABEL
    : formatter(value) + ' ' + unit;
  return branch.name + ': ' + text;
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

  App.BRANCHES.forEach(function (b) {
    if (mode === 'qty') {
      lines.push(branchLine(b, item.branchQty[b.key], 'حبة', App.formatInt));
    } else {
      lines.push(branchLine(b, item.branchSales[b.key], 'ريال', App.formatMoney));
    }
  });

  return lines.join('\n');
}

App.reportTitle = function (mode, dateDisplay) {
  return mode === 'qty'
    ? 'أكثر 20 موديل بيعًا (كمية) ليوم ' + dateDisplay
    : 'أكثر 20 موديل بيعًا (مبلغ البيع) ليوم ' + dateDisplay;
};

/**
 * يبني نص التقرير الكامل الجاهز للنسخ (واتساب/تيليجرام)
 * mode: 'qty' أو 'sales'
 */
App.buildReportText = function (list, mode, dateDisplay) {
  var title = App.reportTitle(mode, dateDisplay) + ':';

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
  if (!notes || notes.length === 0) return 'لم يتم رصد أي ملاحظات على البيانات.';
  return 'ملاحظات على البيانات:\n\n' + notes.map(function (n) { return '• ' + n; }).join('\n');
};

// ===== نسخة HTML مبسّطة لتصدير PDF (نص فقط، بدون صور، لأصغر حجم ممكن) =====

function branchRowHtml(branch, value, unit, formatter) {
  var found = !(value === undefined || value === null || Math.abs(value) < 0.005);
  var text = found ? formatter(value) + ' ' + unit : App.MODEL_NOT_FOUND_LABEL;
  return '<div class="p-branch' + (found ? '' : ' p-branch-empty') + '">' +
    '<span class="p-branch-name">' + App.escapeHtml(branch.name) + '</span>' +
    '<span class="p-branch-value">' + App.escapeHtml(text) + '</span>' +
    '</div>';
}

function buildEntryHtml(item, index, mode) {
  var totalLine = mode === 'qty'
    ? App.formatInt(item.totalQty) + ' حبة'
    : App.formatMoney(item.totalSales) + ' ريال';

  var branchesHtml = App.BRANCHES.map(function (b) {
    return mode === 'qty'
      ? branchRowHtml(b, item.branchQty[b.key], 'حبة', App.formatInt)
      : branchRowHtml(b, item.branchSales[b.key], 'ريال', App.formatMoney);
  }).join('');

  return '' +
    '<section class="p-entry">' +
      '<div class="p-entry-head">' +
        '<span class="p-rank">#' + (index + 1) + '</span>' +
        '<span class="p-model-code">' + App.escapeHtml(item.modelCode) + '</span>' +
      '</div>' +
      '<div class="p-model-name">' + App.escapeHtml(item.modelName || '—') + '</div>' +
      '<div class="p-meta-row">' +
        '<span>' + App.escapeHtml(item.priceLine) + '</span>' +
        '<span>' + App.escapeHtml(item.supplierName || '—') + '</span>' +
      '</div>' +
      '<div class="p-total">إجمالي البيع: <strong>' + App.escapeHtml(totalLine) + '</strong></div>' +
      '<div class="p-branches">' + branchesHtml + '</div>' +
    '</section>';
}

/**
 * يبني HTML مخصّص للطباعة/تصدير PDF (نص خالص، لا صور) لتقرير كامل.
 * mode: 'qty' أو 'sales'
 */
App.buildReportHTML = function (list, mode, dateDisplay) {
  var title = App.reportTitle(mode, dateDisplay);
  var body = (!list || list.length === 0)
    ? '<p class="p-empty">لا توجد بيانات مطابقة لهذا اليوم.</p>'
    : list.map(function (item, i) { return buildEntryHtml(item, i, mode); }).join('');

  return '<h1 class="p-title">' + App.escapeHtml(title) + '</h1>' + body;
};

App.buildNotesHTML = function (notes, dateDisplay) {
  var title = 'ملاحظات على البيانات ليوم ' + dateDisplay;
  if (!notes || notes.length === 0) {
    return '<h1 class="p-title">' + App.escapeHtml(title) + '</h1><p class="p-empty">لم يتم رصد أي ملاحظات على البيانات.</p>';
  }
  var items = notes.map(function (n) { return '<li>' + App.escapeHtml(n) + '</li>'; }).join('');
  return '<h1 class="p-title">' + App.escapeHtml(title) + '</h1><ul class="p-notes-list">' + items + '</ul>';
};
