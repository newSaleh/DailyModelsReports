/*
 * إعدادات ثابتة: الفروع والحقول المتعرَّف عليها من ملف Excel أو النص الملصوق.
 * لإضافة فرع جديد أو حقل جديد لاحقًا، عدّل هذا الملف فقط.
 */
window.App = window.App || {};

// رموز الفروع وأسماؤها. هذا الترتيب (701/706/707/711/803) هو الترتيب الأساسي
// المستخدم في الجداول (أعمدة ثابتة الهوية)؛ التقارير النصية تعيد ترتيب هذه
// الفروع لكل موديل من الأكثر مبيعًا إلى الأقل (راجع report.js).
// balanceAliases: عمود "الرصيد/المخزون" لكل فرع (اختياري). يُستخدم فقط لتمييز
// "0 حبة" (الفرع يملك مخزونًا من هذا الموديل لكن مبيعاته صفر اليوم) عن
// "غير موجود" (لا مخزون لهذا الموديل في هذا الفرع إطلاقًا). راجع report.js
App.BRANCHES = [
  { key: '701', name: 'الدائري', aliases: ['701soldqty', '701sold', '701qty', '701', 'الدائري', 'aldaeri', 'aldairi'], balanceAliases: ['701balance', '701bal', '701stock', 'رصيدالدائري'] },
  { key: '706', name: 'الفيحاء', aliases: ['706soldqty', '706sold', '706qty', '706', 'الفيحاء', 'alfayhaa', 'alfayha'], balanceAliases: ['706balance', '706bal', '706stock', 'رصيدالفيحاء'] },
  { key: '707', name: 'البديعة', aliases: ['707soldqty', '707sold', '707qty', '707', 'البديعة', 'albadiah', 'albadeah'], balanceAliases: ['707balance', '707bal', '707stock', 'رصيدالبديعة'] },
  { key: '711', name: 'القصيم', aliases: ['711soldqty', '711sold', '711qty', '711', 'القصيم', 'alqassim', 'alqaseem'], balanceAliases: ['711balance', '711bal', '711stock', 'رصيدالقصيم'] },
  { key: '803', name: 'التحلية', aliases: ['803soldqty', '803sold', '803qty', '803', 'التحلية', 'altahlia', 'altahliah'], balanceAliases: ['803balance', '803bal', '803stock', 'رصيدالتحلية'] },
];

// أسماء الأعمدة المحتملة (عربي/إنجليزي) لكل حقل أساسي. المطابقة تتم بعد إزالة
// المسافات والشرطات وتحويل الأحرف الإنجليزية لحروف صغيرة.
App.FIELD_ALIASES = {
  supplierCode: ['suppliercode', 'supplier_code', 'supplierno', 'كودالمورد', 'رقمالمورد'],
  supplierName: ['suppliername', 'supplier_name', 'اسمالمورد', 'المورد'],
  modelCode: ['modelcode', 'model_code', 'كودالموديل', 'رقمالموديل', 'الموديلكود', 'modelno'],
  modelName: ['modelname', 'model_name', 'اسمالموديل', 'وصفالموديل', 'modeldesc', 'modeldescription'],
  category: ['stockgroupname', 'stockgroup', 'category', 'الفئة', 'التصنيف', 'المجموعة'],
  stockCode: ['stockcode', 'sku', 'الصنف', 'كودالصنف'],
  unitPrice: ['unitprice', 'unit_price', 'price', 'سعر', 'السعر', 'سعرالوحدة', 'سعرالبيع'],
  qtyTotal: ['totalqtysold', 'totalqty', 'total_qty', 'qty', 'quantity', 'الكمية', 'كمية', 'الكميةالمباعة'],
  salesAmount: ['salesamount', 'totalsales', 'sales', 'sales_amount', 'مبلغالبيع', 'المبلغ', 'قيمةالبيع', 'إجماليالبيع'],
  branchCol: ['branch', 'الفرع', 'فرع'],
  date: ['date', 'تاريخ', 'تاريخالبيع', 'salesdate'],
};

App.MODEL_NOT_FOUND_LABEL = 'غير موجود';

// أقصى عدد موديلات يبقى فيه تصدير PDF بالوضع الأفقي (Landscape) مريحًا في
// صفحة A4 واحدة؛ أي عدد أكبر (مثلًا 50) يتحول تلقائيًا للوضع الطولي
// (Portrait) الذي يمنح ارتفاعًا أكبر. راجع js/app.js
App.MAX_LANDSCAPE_ROWS = 20;
