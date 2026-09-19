window.App = window.App || {};

// توحيد اسم العمود للمقارنة: إزالة المسافات/الشرطات وتحويل الإنجليزي لحروف صغيرة
App.normalizeHeader = function (h) {
  if (h === null || h === undefined) return '';
  return String(h).trim().toLowerCase().replace(/[\s_\-]+/g, '');
};

// إزالة "ال" التعريف من بداية النص المطبّع، لمقارنة أكثر مرونة بين
// "المورد" و"مورد" مثلًا
App.stripAl = function (s) {
  return s.indexOf('ال') === 0 ? s.slice(2) : s;
};

// يقارن عنوانًا مطبّعًا بقائمة أسماء بديلة، بتجاهل "ال" التعريف في أي منهما
App.headerMatchesAny = function (normalizedHeader, aliases) {
  var h = App.stripAl(normalizedHeader);
  for (var i = 0; i < aliases.length; i++) {
    if (App.stripAl(aliases[i]) === h) return true;
  }
  return false;
};

App.toNumber = function (v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).trim().replace(/,/g, '');
  if (s === '') return null;
  var n = parseFloat(s);
  return isFinite(n) ? n : null;
};

App.trimOrEmpty = function (v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
};

App.formatInt = function (n) {
  return Math.round(n).toLocaleString('en-US');
};

App.formatMoney = function (n) {
  var rounded = Math.round(n * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.005) {
    return Math.round(rounded).toLocaleString('en-US');
  }
  return rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// تنسيق تاريخ Date إلى DD/MM/YYYY
App.formatDateDMY = function (d) {
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
};

// يحاول تحويل قيمة تاريخ (نص، أو رقم تسلسلي من Excel) إلى مفتاح "YYYY-MM-DD"
App.parseDateKey = function (v) {
  if (v === null || v === undefined || v === '') return null;

  // رقم تسلسلي من Excel (أيام منذ 1900)
  if (typeof v === 'number') {
    var epoch = new Date(Date.UTC(1899, 11, 30));
    var d = new Date(epoch.getTime() + v * 86400000);
    if (isNaN(d.getTime())) return null;
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  var s = String(v).trim();
  if (s === '') return null;

  var m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yyyy = parseInt(m[3], 10);
    return yyyy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    var yyyy2 = parseInt(m[1], 10), mm2 = parseInt(m[2], 10), dd2 = parseInt(m[3], 10);
    return yyyy2 + '-' + String(mm2).padStart(2, '0') + '-' + String(dd2).padStart(2, '0');
  }
  var d2 = new Date(s);
  if (!isNaN(d2.getTime())) {
    return d2.getFullYear() + '-' + String(d2.getMonth() + 1).padStart(2, '0') + '-' + String(d2.getDate()).padStart(2, '0');
  }
  return null;
};

// تحويل قيمة input[type=date] (YYYY-MM-DD) إلى تاريخ عرض DD/MM/YYYY
App.dateInputToDisplay = function (isoStr) {
  var parts = isoStr.split('-');
  if (parts.length !== 3) return isoStr;
  return parts[2] + '/' + parts[1] + '/' + parts[0];
};
