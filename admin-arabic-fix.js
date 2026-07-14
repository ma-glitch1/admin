(function () {
  const byId = (id) => document.getElementById(id);
  const setText = (selector, text) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = text;
  };

  const tabTitles = {
    orders: "الطلبات الواردة",
    "accepted-orders": "الطلبات المقبولة",
    products: "إدارة المنتجات",
    categories: "إدارة الفئات",
    banners: "إدارة البنرات",
    settings: "إعدادات التوصيل",
  };

  function fixStaticLabels() {
    document.title = "لوحة الإدارة - المتجر";
    setText(".sidebar-header h2", "لوحة الإدارة");

    document.querySelectorAll(".sidebar-menu li").forEach((item) => {
      const tab = item.getAttribute("data-tab");
      if (tabTitles[tab]) item.textContent = tabTitles[tab];
    });

    const activeTab = document.querySelector(".sidebar-menu li.active")?.getAttribute("data-tab") || "orders";
    setText(".top-header h3", tabTitles[activeTab] || "لوحة الإدارة");

    setText("#products-tab .products-header h3", "إدارة المنتجات");
    setText("#add-product-btn", "إضافة منتج جديد");
    setText("#add-product-form h4", "معلومات المنتج الجديد");
    setText("label[for='new-product-name']", "اسم المنتج");

    const labels = document.querySelectorAll("label");
    labels.forEach((label) => {
      const next = label.nextElementSibling;
      const targetId = next?.id;
      const map = {
        "new-product-name": "اسم المنتج",
        "new-product-price": "السعر (د.ع)",
        "new-product-category": "الفئة",
        "new-product-image": "صورة المنتج",
        "edit-product-name": "اسم المنتج",
        "edit-product-price": "السعر (د.ع)",
        "edit-product-category": "الفئة",
        "edit-product-image": "تغيير الصورة (اختياري)",
        "new-category-name": "اسم الفئة",
        "new-category-image": "صورة الفئة (أيقونة)",
        "edit-category-name": "اسم الفئة",
        "edit-category-image": "تغيير صورة الفئة (اختياري)",
        "new-banner-image": "صورة البنر",
        "delivery-cost-input": "كلفة التوصيل (د.ع)",
      };
      if (map[targetId]) label.textContent = map[targetId];
    });

    const placeholders = {
      "new-product-name": "اسم المنتج...",
      "new-product-price": "مثال: 25000",
      "new-category-name": "اسم الفئة...",
      "delivery-cost-input": "مثال: 5000",
    };
    Object.entries(placeholders).forEach(([id, text]) => {
      const input = byId(id);
      if (input) input.placeholder = text;
    });

    setText("#edit-product-form h4", "تعديل المنتج");
    setText("#save-product-btn", "حفظ المنتج");
    setText("#update-product-btn", "حفظ التعديلات");
    setText("#cancel-edit-btn", "إلغاء");

    setText("#categories-tab .categories-header h3", "إدارة الفئات");
    setText("#add-category-btn", "إضافة فئة جديدة");
    setText("#add-category-form h4", "معلومات الفئة الجديدة");
    setText("#save-category-btn", "حفظ الفئة");
    setText("#edit-category-form h4", "تعديل الفئة");
    setText("#update-category-btn", "حفظ التعديلات");
    setText("#cancel-category-edit-btn", "إلغاء");

    setText("#banners-tab .banners-header h3", "إدارة البنرات");
    setText("#add-banner-btn", "إضافة بنر جديد");
    setText("#add-banner-form h4", "صورة البنر الجديد");
    setText("#add-banner-form p", "يفضل أن تكون الصورة بعرض مناسب للمتجر (أفقية).");
    setText("#save-banner-btn", "حفظ البنر");

    setText("#settings-tab > h3", "الإعدادات");
    setText("#settings-tab h4", "إعدادات التوصيل");
    setText("#save-delivery-cost-btn", "حفظ كلفة التوصيل");

    document.querySelectorAll("option").forEach((option) => {
      const map = {
        fashion: "أزياء",
        electronics: "إلكترونيات",
        home: "منزلية",
        beauty: "جمال",
        books: "كتب",
      };
      if (map[option.value]) option.textContent = map[option.value];
    });
  }

  function keepHeaderTitleUpdated() {
    document.querySelectorAll(".sidebar-menu li").forEach((item) => {
      item.addEventListener("click", () => {
        const tab = item.getAttribute("data-tab");
        setTimeout(() => setText(".top-header h3", tabTitles[tab] || "لوحة الإدارة"), 0);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    fixStaticLabels();
    keepHeaderTitleUpdated();
    document.addEventListener("click", () => setTimeout(fixStaticLabels, 0));
  });
})();
