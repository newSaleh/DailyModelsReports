window.App = window.App || {};

App.DIVIDER = '⸻';

function branchLine(branch, value) {
  var text = (value === undefined || value === null || Math.abs(value) < 0.005)
    ? App.MODEL_NOT_FOUND_LABEL
    : App.formatInt(value) + ' حبة';
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
    lines.push(branchLine(b, item.branchQty[b.key]));
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

// ===== نسخة HTML مبسّطة لتصدير PDF (نص فقط، بدون صور، لأصغر حجم ممكن) =====
// جدول واحد مضغوط يجمع كل الموديلات الـ20 في صفحة A4 واحدة (أفقية لاتساع أكبر).

function buildTableRowHtml(item, index, mode) {
  var totalText = mode === 'qty'
    ? App.formatInt(item.totalQty) + ' حبة'
    : App.formatMoney(item.totalSales) + ' ريال';

  // تفصيل الفروع بالكمية دائمًا، حتى في تقرير مبلغ البيع
  var branchCells = App.BRANCHES.map(function (b) {
    var value = item.branchQty[b.key];
    var found = !(value === undefined || value === null || Math.abs(value) < 0.005);
    var text = found ? App.formatInt(value) : App.MODEL_NOT_FOUND_LABEL;
    return '<td class="p-td-num' + (found ? '' : ' p-td-empty') + '">' + App.escapeHtml(text) + '</td>';
  }).join('');

  return '' +
    '<tr>' +
      '<td class="p-td-rank">' + (index + 1) + '</td>' +
      '<td class="p-td-code">' + App.escapeHtml(item.modelCode) + '</td>' +
      '<td>' + App.escapeHtml(item.modelName || '—') + '</td>' +
      '<td>' + App.escapeHtml(item.priceLine) + '</td>' +
      '<td>' + App.escapeHtml(item.supplierName || '—') + '</td>' +
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
  var title = App.reportTitle(mode, dateDisplay);
  if (!list || list.length === 0) {
    return '<h1 class="p-title">' + App.escapeHtml(title) + '</h1><p class="p-empty">لا توجد بيانات مطابقة لهذا اليوم.</p>';
  }

  var rows = list.map(function (item, i) { return buildTableRowHtml(item, i, mode); }).join('');
  // في تقرير المبلغ يُضاف "(حبة)" لتوضيح أن أعمدة الفروع كمية وليست مبلغًا
  var branchSuffix = mode === 'sales' ? ' (حبة)' : '';
  var branchHeaders = App.BRANCHES.map(function (b) { return '<th>' + App.escapeHtml(b.name + branchSuffix) + '</th>'; }).join('');

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
