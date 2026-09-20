(function () {
  var fileInput = document.getElementById('fileInput');
  var sheetSelectWrap = document.getElementById('sheetSelectWrap');
  var sheetSelect = document.getElementById('sheetSelect');
  var pasteArea = document.getElementById('pasteArea');
  var dateInput = document.getElementById('dateInput');
  var dateHint = document.getElementById('dateHint');
  var topNInput = document.getElementById('topNInput');
  var supplierDropdownToggle = document.getElementById('supplierDropdownToggle');
  var supplierDropdownToggleText = document.getElementById('supplierDropdownToggleText');
  var supplierDropdownPanel = document.getElementById('supplierDropdownPanel');
  var supplierSearchInput = document.getElementById('supplierSearchInput');
  var selectAllSuppliersBtn = document.getElementById('selectAllSuppliersBtn');
  var supplierCheckList = document.getElementById('supplierCheckList');
  var analyzeBtn = document.getElementById('analyzeBtn');
  var statusMsg = document.getElementById('statusMsg');
  var resultsSection = document.getElementById('resultsSection');
  var qtyCardTitle = document.getElementById('qtyCardTitle');
  var salesCardTitle = document.getElementById('salesCardTitle');
  var qtyReportText = document.getElementById('qtyReportText');
  var salesReportText = document.getElementById('salesReportText');
  var notesText = document.getElementById('notesText');

  var printArea = document.getElementById('printArea');

  var workbook = null;
  var lastResult = null;
  var lastDateDisplay = '';

  // ===== قائمة اختيار الموردين =====
  var supplierDirectory = []; // [{root, name, codes}]
  var allSuppliersSelected = true;
  var selectedSupplierRoots = {}; // root -> true

  function updateSupplierToggleText() {
    if (allSuppliersSelected) {
      supplierDropdownToggleText.textContent = 'كل الموردين';
      return;
    }
    var count = Object.keys(selectedSupplierRoots).length;
    if (count === 0) {
      supplierDropdownToggleText.textContent = 'لم يُحدَّد أي مورد';
    } else if (count === 1) {
      var root = Object.keys(selectedSupplierRoots)[0];
      var found = supplierDirectory.filter(function (s) { return s.root === root; })[0];
      supplierDropdownToggleText.textContent = found ? found.name : (count + ' مورد محدد');
    } else {
      supplierDropdownToggleText.textContent = count + ' موردين محددين';
    }
  }

  function renderSupplierCheckList() {
    supplierCheckList.innerHTML = '';
    if (supplierDirectory.length === 0) {
      var p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'لا يوجد عمود مورد في البيانات المدخلة، أو لم تُرفع بيانات بعد.';
      supplierCheckList.appendChild(p);
      return;
    }
    supplierDirectory.forEach(function (s) {
      var label = document.createElement('label');
      label.className = 'supplier-check-item';
      label.dataset.name = s.name;

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = s.root;
      cb.checked = !!selectedSupplierRoots[s.root];

      var span = document.createElement('span');
      span.textContent = s.name + (s.codes.length ? ' (' + s.codes.join('/') + ')' : '');

      cb.addEventListener('change', function () {
        if (cb.checked) selectedSupplierRoots[s.root] = true;
        else delete selectedSupplierRoots[s.root];
        // بلا أي تحديد فردي = كل الموردين (بلا فلترة)
        allSuppliersSelected = Object.keys(selectedSupplierRoots).length === 0;
        updateSupplierToggleText();
      });

      label.appendChild(cb);
      label.appendChild(span);
      supplierCheckList.appendChild(label);
    });
  }

  function refreshSupplierList() {
    var rows2D = getRows2D();
    supplierDirectory = rows2D ? App.buildSupplierDirectory(rows2D) : [];
    allSuppliersSelected = true;
    selectedSupplierRoots = {};
    supplierSearchInput.value = '';
    renderSupplierCheckList();
    updateSupplierToggleText();
  }

  supplierDropdownToggle.addEventListener('click', function () {
    var isHidden = supplierDropdownPanel.classList.toggle('hidden');
    supplierDropdownToggle.setAttribute('aria-expanded', String(!isHidden));
  });

  document.addEventListener('click', function (e) {
    if (supplierDropdownPanel.classList.contains('hidden')) return;
    if (supplierDropdownPanel.contains(e.target) || supplierDropdownToggle.contains(e.target)) return;
    supplierDropdownPanel.classList.add('hidden');
    supplierDropdownToggle.setAttribute('aria-expanded', 'false');
  });

  supplierSearchInput.addEventListener('input', function () {
    var q = supplierSearchInput.value.trim().toLowerCase();
    Array.prototype.forEach.call(supplierCheckList.querySelectorAll('.supplier-check-item'), function (item) {
      var name = (item.dataset.name || '').toLowerCase();
      item.classList.toggle('no-match', q !== '' && name.indexOf(q) === -1);
    });
  });

  selectAllSuppliersBtn.addEventListener('click', function () {
    allSuppliersSelected = true;
    selectedSupplierRoots = {};
    Array.prototype.forEach.call(supplierCheckList.querySelectorAll('input[type="checkbox"]'), function (el) { el.checked = false; });
    updateSupplierToggleText();
  });

  // التاريخ الافتراضي = اليوم
  (function initDate() {
    var today = new Date();
    var iso = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    dateInput.value = iso;
    updateDateHint();
  })();

  dateInput.addEventListener('change', updateDateHint);

  function updateDateHint() {
    if (!dateInput.value) { dateHint.textContent = ''; return; }
    dateHint.textContent = 'سيظهر في التقرير باسم: ' + App.dateInputToDisplay(dateInput.value) +
      '. إن لم توجد بيانات تاريخ داخل الملف، فسيُستخدم هذا التاريخ كتسمية للتقرير فقط، وسيتم تحليل كل السجلات المدخلة.';
  }

  fileInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    workbook = null;
    sheetSelectWrap.classList.add('hidden');
    sheetSelect.innerHTML = '';
    if (!file) return;

    setStatus('جارٍ قراءة الملف...', false);
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        workbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: false });
        var names = workbook.SheetNames || [];
        if (names.length > 1) {
          names.forEach(function (n) {
            var opt = document.createElement('option');
            opt.value = n; opt.textContent = n;
            sheetSelect.appendChild(opt);
          });
          sheetSelectWrap.classList.remove('hidden');
        }
        setStatus('تم تحميل الملف بنجاح (' + names.length + ' ورقة). اضغط "تحليل المبيعات" للمتابعة.', false);
        refreshSupplierList();
      } catch (err) {
        workbook = null;
        setStatus('تعذّر قراءة ملف Excel: ' + err.message, true);
      }
    };
    reader.onerror = function () {
      setStatus('تعذّر قراءة الملف من الجهاز.', true);
    };
    reader.readAsArrayBuffer(file);
  });

  function setStatus(msg, isError) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status' + (isError ? ' error' : '');
  }

  function getRows2D() {
    if (workbook) {
      var sheetName = sheetSelect.value || workbook.SheetNames[0];
      var ws = workbook.Sheets[sheetName];
      if (!ws) return null;
      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    }
    var text = pasteArea.value.trim();
    if (text) return App.parsePastedText(text);
    return null;
  }

  sheetSelect.addEventListener('change', refreshSupplierList);

  var pasteRefreshTimer = null;
  pasteArea.addEventListener('input', function () {
    clearTimeout(pasteRefreshTimer);
    pasteRefreshTimer = setTimeout(refreshSupplierList, 400);
  });

  analyzeBtn.addEventListener('click', function () {
    var rows2D = getRows2D();
    if (!rows2D || rows2D.length < 2) {
      setStatus('الرجاء رفع ملف Excel أو لصق بيانات تحتوي على صف عناوين وصف بيانات على الأقل.', true);
      return;
    }
    if (!dateInput.value) {
      setStatus('الرجاء اختيار التاريخ.', true);
      return;
    }
    var topN = parseInt(topNInput.value, 10);
    if (!topN || topN < 1) {
      setStatus('الرجاء إدخال عدد موديلات صحيح (1 أو أكثر).', true);
      return;
    }
    var supplierFilter = allSuppliersSelected ? null : Object.keys(selectedSupplierRoots);

    analyzeBtn.disabled = true;
    setStatus('جارٍ التحليل، قد يستغرق ذلك بضع ثوانٍ مع الملفات الكبيرة...', false);
    resultsSection.classList.add('hidden');

    // تأجيل بسيط للسماح للواجهة بتحديث حالة "جارٍ التحليل" قبل المعالجة الثقيلة
    setTimeout(function () {
      try {
        var result = App.analyze(rows2D, { selectedDateKey: dateInput.value, topN: topN, supplierFilter: supplierFilter });
        if (result.error) {
          setStatus(result.error, true);
          analyzeBtn.disabled = false;
          return;
        }

        var dateDisplay = App.dateInputToDisplay(dateInput.value);
        qtyCardTitle.textContent = App.reportTitle(result.qtyList, 'qty', dateDisplay);
        salesCardTitle.textContent = App.reportTitle(result.salesList, 'sales', dateDisplay);
        qtyReportText.textContent = App.buildReportText(result.qtyList, 'qty', dateDisplay);
        salesReportText.textContent = App.buildReportText(result.salesList, 'sales', dateDisplay);
        notesText.textContent = App.buildNotesText(result.notes);

        lastResult = result;
        lastDateDisplay = dateDisplay;

        resultsSection.classList.remove('hidden');
        setStatus('تم التحليل بنجاح. عدد الموديلات بعد الدمج: ' + App.formatInt(result.totalModels) + '.', false);
      } catch (err) {
        setStatus('حدث خطأ أثناء التحليل: ' + err.message, true);
      } finally {
        analyzeBtn.disabled = false;
      }
    }, 20);
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.copy-btn');
    if (!btn) return;
    var targetId = btn.getAttribute('data-target');
    var el = document.getElementById(targetId);
    if (!el) return;
    var text = el.textContent;

    function markCopied() {
      var original = btn.textContent;
      btn.textContent = 'تم النسخ ✓';
      btn.classList.add('copied');
      setTimeout(function () { btn.textContent = original; btn.classList.remove('copied'); }, 1500);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(markCopied).catch(function () { fallbackCopy(text, markCopied); });
    } else {
      fallbackCopy(text, markCopied);
    }
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.pdf-btn');
    if (!btn) return;
    exportReportToPdf(btn.getAttribute('data-report'));
  });

  var dynamicPrintStyle = document.getElementById('dynamicPrintStyle');

  function exportReportToPdf(reportKey) {
    if (!lastResult) return;

    var html, fileTitle, pageCss;
    if (reportKey === 'notes') {
      html = App.buildNotesHTML(lastResult.notes, lastDateDisplay);
      fileTitle = 'ملاحظات على البيانات ليوم ' + lastDateDisplay;
      pageCss = '@page { size: A4 portrait; margin: 14mm 12mm; }';
    } else {
      var list = reportKey === 'qty' ? lastResult.qtyList : lastResult.salesList;
      html = App.buildReportHTML(list, reportKey, lastDateDisplay);
      fileTitle = App.reportTitle(list, reportKey, lastDateDisplay);
      pageCss = '@page { size: A4 landscape; margin: 10mm; }';
    }

    printArea.innerHTML = html;
    dynamicPrintStyle.textContent = '@media print { ' + pageCss + ' }';
    var previousTitle = document.title;
    document.title = fileTitle;
    document.body.classList.add('printing');

    function cleanup() {
      document.body.classList.remove('printing');
      document.title = previousTitle;
      printArea.innerHTML = '';
      dynamicPrintStyle.textContent = '';
      window.removeEventListener('afterprint', cleanup);
    }
    window.addEventListener('afterprint', cleanup);

    // تأجيل بسيط لضمان تطبيق التنسيق قبل فتح نافذة الطباعة
    setTimeout(function () {
      window.print();
      // شبكة أمان في حال لم يدعم المتصفح afterprint (نادر جدًا)؛ لا تُنفَّذ عادة
      setTimeout(cleanup, 60000);
    }, 30);
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    if (done) done();
  }
})();
