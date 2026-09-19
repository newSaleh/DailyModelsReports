/*
 * إعدادات ثابتة: الفروع والحقول المتعرَّف عليها من ملف Excel أو النص الملصوق.
 * لإضافة فرع جديد أو حقل جديد لاحقًا، عدّل هذا الملف فقط.
 */
window.App = window.App || {};

// ترتيب الفروع ثابت دائمًا بهذا الشكل في كل التقارير
App.BRANCHES = [
  { key: '701', name: 'الدائري', aliases: ['701soldqty', '701sold', '701qty', '701', 'الدائري', 'aldaeri', 'aldairi'] },
  { key: '706', name: 'التحلية', aliases: ['706soldqty', '706sold', '706qty', '706', 'التحلية', 'altahlia', 'altahliah'] },
  { key: '707', name: 'البديعة', aliases: ['707soldqty', '707sold', '707qty', '707', 'البديعة', 'albadiah', 'albadeah'] },
  { key: '711', name: 'الفيحاء', aliases: ['711soldqty', '711sold', '711qty', '711', 'الفيحاء', 'alfayhaa', 'alfayha'] },
  { key: '803', name: 'القصيم', aliases: ['803soldqty', '803sold', '803qty', '803', 'القصيم', 'alqassim', 'alqaseem'] },
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
