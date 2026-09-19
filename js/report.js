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

/**
 * يبني نص التقرير الكامل الجاهز للنسخ (واتساب/تيليجرام)
 * mode: 'qty' أو 'sales'
 */
App.buildReportText = function (list, mode, dateDisplay) {
  var title = mode === 'qty'
    ? 'أكثر 20 موديل بيعًا (كمية) ليوم ' + dateDisplay + ':'
    : 'أكثر 20 موديل بيعًا (مبلغ البيع) ليوم ' + dateDisplay + ':';

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
