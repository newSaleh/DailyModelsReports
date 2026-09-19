window.App = window.App || {};

// يبني خريطة { fieldName: columnIndex } من صف العناوين
App.buildFieldColumnMap = function (headers) {
  var normalized = headers.map(App.normalizeHeader);
  var map = {};
  Object.keys(App.FIELD_ALIASES).forEach(function (field) {
    var aliases = App.FIELD_ALIASES[field];
    var idx = -1;
    for (var i = 0; i < normalized.length; i++) {
      if (App.headerMatchesAny(normalized[i], aliases)) { idx = i; break; }
    }
    map[field] = idx;
  });
  return map;
};

// يبني خريطة { branchKey: columnIndex } لأعمدة الفروع الموسّعة (Wide format)
App.buildBranchColumnMap = function (headers) {
  var normalized = headers.map(App.normalizeHeader);
  var map = {};
  App.BRANCHES.forEach(function (branch) {
    var idx = -1;
    for (var i = 0; i < normalized.length; i++) {
      if (App.headerMatchesAny(normalized[i], branch.aliases)) { idx = i; break; }
    }
    map[branch.key] = idx;
  });
  return map;
};

// يحاول مطابقة نص فرع (من عمود فرع في صيغة Pivot) لأحد الفروع المعروفة
App.matchBranchByText = function (text) {
  var n = App.normalizeHeader(text);
  if (!n) return null;
  for (var i = 0; i < App.BRANCHES.length; i++) {
    var b = App.BRANCHES[i];
    if (App.headerMatchesAny(n, b.aliases) || App.stripAl(App.normalizeHeader(b.name)) === App.stripAl(n)) return b.key;
  }
  return null;
};

// يفكك نصًا ملصوقًا (Tab / CSV / مسافات متعددة) إلى مصفوفة صفوف [ [..], [..] ]
App.parsePastedText = function (text) {
  var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
    .filter(function (l) { return l.trim() !== ''; });
  if (lines.length === 0) return [];

  var delimiter = '\t';
  if (lines[0].indexOf('\t') !== -1) {
    delimiter = '\t';
  } else if (lines[0].indexOf(',') !== -1 && lines[0].split(',').length > 1) {
    delimiter = ',';
  } else if (lines[0].indexOf(';') !== -1) {
    delimiter = ';';
  } else {
    delimiter = /\s{2,}/;
  }

  return lines.map(function (line) {
    return line.split(delimiter).map(function (c) { return c.trim(); });
  });
};
