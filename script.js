const BUNNY_STORAGE_ZONE = "iihhoho";
const BUNNY_CDN_HOST = "ikjhkjhjhk.b-cdn.net";
const BUNNY_ACCESS_KEY = "7b016d8d-5f9a-4416-ba5e581f682a-86f3-49fd";
const BUNNY_STORAGE_ENDPOINT = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
const IMAGE_FALLBACK_URL = "https://cdn-icons-png.flaticon.com/512/149/149852.png";

function isBunnyCdnUrl(url) {
  return typeof url === "string" && url.includes(`${BUNNY_CDN_HOST}/`);
}

async function recoverBunnyImage(img) {
  const cdnUrl = img.getAttribute("src") || "";
  if (!isBunnyCdnUrl(cdnUrl) || img.dataset.recovered === "1") {
    img.src = IMAGE_FALLBACK_URL;
    return;
  }

    img.dataset.recovered = "1";
    try {
      const cleanUrl = cdnUrl.split("?")[0];
      const filePath = cleanUrl.split(`${BUNNY_CDN_HOST}/`)[1];
    const storageUrl = location.hostname === "127.0.0.1" || location.hostname === "localhost"
      ? `/__bunny_proxy/${filePath}`
      : `${BUNNY_STORAGE_ENDPOINT}/${filePath}`;
    const headers = storageUrl.startsWith("/__bunny_proxy/")
      ? {}
      : { AccessKey: BUNNY_ACCESS_KEY };
    const response = await fetch(storageUrl, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Storage image failed: ${response.status}`);
    const blob = await response.blob();
    img.src = URL.createObjectURL(blob);
  } catch (error) {
    console.error("Image recovery failed:", error);
    img.src = IMAGE_FALLBACK_URL;
  }
}

function usePreviewBunnyProxy(img) {
  const src = img.getAttribute("src") || "";
  if (!isBunnyCdnUrl(src)) return;

  const cleanUrl = src.split("?")[0];
  const filePath = cleanUrl.split(`${BUNNY_CDN_HOST}/`)[1];
  if (!filePath) return;

  if (location.hostname === "127.0.0.1" || location.hostname === "localhost") {
    img.src = `/__bunny_proxy/${filePath}`;
  }
}

function refreshBunnyImages() {
  document.querySelectorAll(`img[src*="${BUNNY_CDN_HOST}"]`).forEach(usePreviewBunnyProxy);
}

function stripInlineImages(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (typeof item?.image === "string" && item.image.startsWith("data:image/")) {
      return { ...item, image: IMAGE_FALLBACK_URL };
    }
    return item;
  });
}

function stripInlineImageValue(value) {
  if (typeof value === "string" && value.startsWith("data:image/")) {
    return IMAGE_FALLBACK_URL;
  }
  return value;
}

function sanitizeImageData(value) {
  if (Array.isArray(value)) {
    return value.map(stripInlineImageValue);
  }

  if (value && typeof value === "object") {
    const cleaned = { ...value };
    if ("image" in cleaned) {
      cleaned.image = stripInlineImageValue(cleaned.image);
    }
    return cleaned;
  }

  return stripInlineImageValue(value);
}

function cleanupInlineImagesFromLocalStorage() {
  ["products", "categories"].forEach((key) => {
    try {
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      const cleaned = stripInlineImages(current);
      if (JSON.stringify(current) !== JSON.stringify(cleaned)) {
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
    } catch (error) {
      console.warn(`Could not clean ${key}:`, error);
    }
  });

  try {
    const banners = JSON.parse(localStorage.getItem("banners") || "[]");
    const cleanedBanners = banners.map(stripInlineImageValue);
    if (JSON.stringify(banners) !== JSON.stringify(cleanedBanners)) {
      localStorage.setItem("banners", JSON.stringify(cleanedBanners));
    }
  } catch (error) {
    console.warn("Could not clean banners:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (localStorage.getItem("dataWiped_v3") !== "true") {
      localStorage.removeItem("products");
      localStorage.removeItem("categories");
      localStorage.removeItem("banners");
      localStorage.removeItem("orders");
      localStorage.removeItem("pendingOrders");
      localStorage.removeItem("acceptedOrders");
      localStorage.removeItem("metaVersion");
      localStorage.setItem("dataWiped_v3", "true");
  }


  cleanupInlineImagesFromLocalStorage();
  initTabs();
  initSidebar();
  loadOrders();
  loadAcceptedOrders();
  initProductsTab();
  initCategoriesTab();
  initBannersTab();
  initSettingsTab();
  refreshBunnyImages();
  const imageRefreshTimer = setInterval(refreshBunnyImages, 500);
  setTimeout(() => clearInterval(imageRefreshTimer), 10000);

  // Add Firebase loaded listener for initial sync and realtime orders
  window.addEventListener("firebaseReady", () => {
    listenForOrders();
    syncOrdersFromFirestore();
    setTimeout(syncOrdersFromFirestore, 2000);
    syncAllDataFromFirestore(); // سحب البيانات من فايربيس عند تحميل الصفحة
  });

  if (window.db && window.firestore) {
    listenForOrders();
    syncOrdersFromFirestore();
    setTimeout(syncOrdersFromFirestore, 2000);
  }
});

async function updateAdminCacheVersion() {
  if (window.db && window.firestore) {
    try {
      await window.firestore.setDoc(
        window.firestore.doc(window.db, "meta", "version"),
        {
          updatedAt: window.firestore.serverTimestamp(),
        },
      );
      console.log("Firebase cache version updated");
    } catch (e) {
      console.error("Error updating meta version:", e);
    }
  }
}

async function syncItemToFirestore(collectionName, itemData, action) {
  itemData = sanitizeImageData(itemData);
  if (window.db && window.firestore) {
    try {
      if (action === "delete") {
        if (itemData.firestoreId) {
          await window.firestore.deleteDoc(
            window.firestore.doc(
              window.db,
              collectionName,
              itemData.firestoreId,
            ),
          );
        } else {
          // Fallback to local id string if no firestoreId
          const querySnap = await window.firestore.getDocs(
            window.firestore.collection(window.db, collectionName),
          );
          querySnap.forEach(async (docSnap) => {
            if (docSnap.data().id === itemData.id) {
              await window.firestore.deleteDoc(docSnap.ref);
            }
          });
        }
      } else if (action === "add") {
        await window.firestore.addDoc(
          window.firestore.collection(window.db, collectionName),
          itemData,
        );
      } else if (action === "update") {
        if (itemData.firestoreId) {
          await window.firestore.updateDoc(
            window.firestore.doc(
              window.db,
              collectionName,
              itemData.firestoreId,
            ),
            itemData,
          );
        } else {
          const querySnap = await window.firestore.getDocs(
            window.firestore.collection(window.db, collectionName),
          );
          querySnap.forEach(async (docSnap) => {
            if (docSnap.data().id === itemData.id) {
              await window.firestore.updateDoc(docSnap.ref, itemData);
            }
          });
        }
      }
      await updateAdminCacheVersion();
    } catch (e) {
      console.error(`Firebase error on ${collectionName}:`, e);
      console.error(
        `حصل خطأ في حفظ ${collectionName} في فايربيس (قد تكون قواعد البيانات Rules تمنع الكتابة): ${e.message}`,
      );
    }
  } else {
    console.warn(
      "لم يتم تجهيز فايربيس بعد. الرجاء الانتظار بضع ثوان والمحاولة مرة أخرى.",
    );
  }
}

function listenForOrders() {
  if (window.db && window.firestore) {
    window.firestore.onSnapshot(
      window.firestore.collection(window.db, "orders"),
      (snapshot) => {
        let firestoreOrders = [];
        snapshot.forEach((doc) => {
          firestoreOrders.push({ firestoreId: doc.id, ...doc.data() });
        });
        // Merge or assign to pending based on status
        const pendingOrders = firestoreOrders.filter(
          (o) => o.status === "pending",
        );
        const acceptedOrders = firestoreOrders.filter(
          (o) => o.status === "accepted",
        );
        localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));
        localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
        loadOrders();
        if (typeof loadAcceptedOrders === "function") loadAcceptedOrders();
      },
    );
  }
}

// دالة جديدة لسحب البيانات الفعلية من فايربيس وتحديث اللوحة بها
async function syncOrdersFromFirestore() {
  if (!window.db || !window.firestore) return;

  try {
    const ordersSnap = await window.firestore.getDocs(
      window.firestore.collection(window.db, "orders"),
    );
    const firestoreOrders = [];
    ordersSnap.forEach((doc) => {
      firestoreOrders.push({ firestoreId: doc.id, ...doc.data() });
    });

    const pendingOrders = firestoreOrders.filter(
      (order) => (order.status || "pending") === "pending",
    );
    const acceptedOrders = firestoreOrders.filter(
      (order) => order.status === "accepted",
    );

    localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));
    localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
    loadOrders();
    if (typeof loadAcceptedOrders === "function") loadAcceptedOrders();
  } catch (error) {
    console.error("Error syncing orders from Firestore:", error);
  }
}

async function syncAllDataFromFirestore() {
  if (window.db && window.firestore) {
    try {
      const productsSnap = await window.firestore.getDocs(window.firestore.collection(window.db, "products"));
      let fetchedProducts = [];
      productsSnap.forEach((doc) => {
        fetchedProducts.push({ firestoreId: doc.id, ...doc.data() });
      });
      fetchedProducts = stripInlineImages(fetchedProducts);
      localStorage.setItem("products", JSON.stringify(fetchedProducts));

      const categoriesSnap = await window.firestore.getDocs(window.firestore.collection(window.db, "categories"));
      let fetchedCategories = [];
      categoriesSnap.forEach((doc) => {
        fetchedCategories.push({ firestoreId: doc.id, ...doc.data() });
      });
      fetchedCategories = stripInlineImages(fetchedCategories);
      localStorage.setItem("categories", JSON.stringify(fetchedCategories));

      if (window.firestore.getDoc) {
        const bannersDoc = await window.firestore.getDoc(window.firestore.doc(window.db, "meta", "banners"));
        if (bannersDoc.exists && bannersDoc.exists()) {
          localStorage.setItem("banners", JSON.stringify(bannersDoc.data().data || []));
        } else {
          localStorage.setItem("banners", JSON.stringify([]));
        }
      }

      populateCategorySelects();
      loadAdminProducts();
      loadAdminCategories();
      loadAdminBanners();
      console.log("تم سحب البيانات من فايربيس بنجاح");
    } catch (e) {
      console.error("Error syncing data from Firestore:", e);
    }
  }
}

// ------------------------------------
// قسم إدارة المنتجات
// ------------------------------------


function initTabs() {
  const tabs = document.querySelectorAll(".sidebar-menu li");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active class from all
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      // Add active class to current
      tab.classList.add("active");
      const targetId = tab.getAttribute("data-tab") + "-tab";
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add("active");
      }
      
      // Close sidebar on mobile after clicking a tab
      if (window.innerWidth <= 768) {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) {
          sidebar.classList.remove("open");
          sidebar.classList.remove("active");
        }
      }
    });
  });
}

function initSidebar() {
  const toggleBtn = document.getElementById("toggle-sidebar");
  const sidebar = document.getElementById("sidebar");

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadOrders() {
  const container = document.getElementById("orders-container");
  if (!container) return;
  const pendingOrders = JSON.parse(localStorage.getItem("pendingOrders") || "[]");

  if (pendingOrders.length === 0) {
    container.innerHTML = "<p>لا توجد طلبات واردة حالياً.</p>";
    return;
  }

  container.innerHTML = "";
  pendingOrders.forEach((order) => {
    const card = document.createElement("div");
    card.className = "order-card";
    const dateStr = new Date(order.date).toLocaleString("ar-IQ");
    
    let itemsHtml = '<ul class="order-items-list">';
    let total = 0;
    if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            total += itemTotal;
            itemsHtml += `<li style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
              <img src="${item.image || IMAGE_FALLBACK_URL}" alt="${item.name}" onerror="recoverBunnyImage(this)" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
              <span>${item.name} x${item.quantity} - ${itemTotal.toLocaleString()} د.ع</span>
            </li>`;
        });
    }
    itemsHtml += '</ul>';
    
    // Add delivery cost to total
    const deliveryCost = parseInt(localStorage.getItem("deliveryCost") || "3000");
    total += deliveryCost;
    const notesHtml = order.customerNotes
      ? `<p><strong>ملاحظات:</strong> ${escapeHtml(order.customerNotes)}</p>`
      : "";

    card.innerHTML = `
      <div class="order-header">
        <h4>طلب رقم: ${order.id || "غير معروف"}</h4>
        <span class="order-date">${dateStr}</span>
      </div>
      <div class="order-details">
        <p><strong>الاسم:</strong> ${order.customerName}</p>
        <p><strong>العنوان:</strong> ${order.customerAddress}</p>
        <p><strong>الهاتف:</strong> ${order.customerPhone}</p>
        ${notesHtml}
        ${itemsHtml}
        <p><strong>أجرة التوصيل:</strong> ${deliveryCost.toLocaleString()} د.ع</p>
        <p><strong>المبلغ الكلي:</strong> ${total.toLocaleString()} د.ع</p>
      </div>
      <div class="order-actions">
        <button class="btn btn-accept" onclick="processOrder('${order.firestoreId || order.id}', 'accept')">قبول الطلب</button>
        <button class="btn btn-reject" onclick="processOrder('${order.firestoreId || order.id}', 'reject')">رفض الطلب</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function loadAcceptedOrders() {
  const container = document.getElementById("accepted-orders-container");
  if (!container) return;
  const acceptedOrders = JSON.parse(localStorage.getItem("acceptedOrders") || "[]");

  if (acceptedOrders.length === 0) {
    container.innerHTML = "<p>لا توجد طلبات مقبولة.</p>";
    return;
  }

  container.innerHTML = "";
  acceptedOrders.forEach((order) => {
    const card = document.createElement("div");
    card.className = "order-card";
    const dateStr = new Date(order.date).toLocaleString("ar-IQ");

    let itemsHtml = '<ul class="order-items-list">';
    let total = 0;
    if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
            const itemTotal = (item.price || 0) * (item.quantity || 1);
            total += itemTotal;
            itemsHtml += `<li style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
              <img src="${item.image || IMAGE_FALLBACK_URL}" alt="${item.name}" onerror="recoverBunnyImage(this)" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
              <span>${item.name} x${item.quantity} - ${itemTotal.toLocaleString()} د.ع</span>
            </li>`;
        });
    }
    itemsHtml += '</ul>';
    
    // Add delivery cost to total
    const deliveryCost = parseInt(localStorage.getItem("deliveryCost") || "3000");
    total += deliveryCost;
    const notesHtml = order.customerNotes
      ? `<p><strong>ملاحظات:</strong> ${escapeHtml(order.customerNotes)}</p>`
      : "";

    card.innerHTML = `
      <div class="order-header">
        <h4>طلب رقم: ${order.id || "غير معروف"}</h4>
        <span class="order-date">${dateStr}</span>
      </div>
      <div class="order-details">
        <p><strong>الاسم:</strong> ${order.customerName}</p>
        <p><strong>العنوان:</strong> ${order.customerAddress}</p>
        <p><strong>الهاتف:</strong> ${order.customerPhone}</p>
        ${notesHtml}
        ${itemsHtml}
        <p><strong>أجرة التوصيل:</strong> ${deliveryCost.toLocaleString()} د.ع</p>
        <p><strong>المبلغ الكلي:</strong> ${total.toLocaleString()} د.ع</p>
      </div>
      <div class="order-actions">
        <button class="btn btn-reject" onclick="deleteAcceptedOrder('${order.firestoreId || order.id}')">حذف الطلب</button>
      </div>
    `;
    container.appendChild(card);
  });
}

window.processOrder = async function (id, action) {
  let pendingOrders = JSON.parse(localStorage.getItem("pendingOrders") || "[]");
  const orderIndex = pendingOrders.findIndex((o) => String(o.firestoreId || o.id) === String(id));

  if (orderIndex > -1) {
    const order = pendingOrders[orderIndex];
    
    if (action === "accept") {
      order.status = "accepted";
      let acceptedOrders = JSON.parse(localStorage.getItem("acceptedOrders") || "[]");
      acceptedOrders.push(order);
      localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
    } else {
      order.status = "rejected";
    }

    pendingOrders.splice(orderIndex, 1);
    localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));

    // Update in Firestore
    if (window.db && window.firestore && order.firestoreId) {
       try {
           await window.firestore.updateDoc(
               window.firestore.doc(window.db, "orders", order.firestoreId),
               { status: order.status }
           );
       } catch (err) {
           console.error("Error updating order in Firestore:", err);
       }
    } else {
       console.log("No firestoreId found or firestore not ready");
    }

    loadOrders();
    loadAcceptedOrders();
  }
};

window.deleteAcceptedOrder = async function (id) {
  if (!confirm("هل أنت متأكد من حذف هذا الطلب المقبول؟")) return;
  
  let acceptedOrders = JSON.parse(localStorage.getItem("acceptedOrders") || "[]");
  const orderIndex = acceptedOrders.findIndex((o) => String(o.firestoreId || o.id) === String(id));

  if (orderIndex > -1) {
    const order = acceptedOrders[orderIndex];
    acceptedOrders.splice(orderIndex, 1);
    localStorage.setItem("acceptedOrders", JSON.stringify(acceptedOrders));
    
    // Update in Firestore
    if (window.db && window.firestore && order.firestoreId) {
       try {
           await window.firestore.deleteDoc(
               window.firestore.doc(window.db, "orders", order.firestoreId)
           );
       } catch (err) {
           console.error("Error deleting order in Firestore:", err);
       }
    }

    loadAcceptedOrders();
  }
};

function populateCategorySelects() {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];

  const newSelect = document.getElementById("new-product-category");
  const editSelect = document.getElementById("edit-product-category");

  let html = "";
  categories.forEach((cat) => {
    const parent = cat.parentId ? categories.find((item) => item.id === cat.parentId) : null;
    const label = parent ? `${parent.name} / ${cat.name}` : cat.name;
    html += `<option value="${cat.id}">${label}</option>`;
  });

  if (newSelect) newSelect.innerHTML = html;
  if (editSelect) editSelect.innerHTML = html;
}

function getMainCategories() {
  const categories = JSON.parse(localStorage.getItem("categories")) || [];
  return categories.filter((cat) => !cat.parentId);
}

function populateParentCategorySelects() {
  const mainCategories = getMainCategories();
  const html = mainCategories
    .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
    .join("");

  const newParent = document.getElementById("new-category-parent");
  const editParent = document.getElementById("edit-category-parent");

  if (newParent) newParent.innerHTML = html;
  if (editParent) editParent.innerHTML = html;
}

function setupCategoryKindControls() {
  [
    { kindId: "new-category-kind", wrapId: "new-parent-category-wrap" },
    { kindId: "edit-category-kind", wrapId: "edit-parent-category-wrap" },
  ].forEach(({ kindId, wrapId }) => {
    const kind = document.getElementById(kindId);
    const wrap = document.getElementById(wrapId);
    if (!kind || !wrap) return;

    const update = () => {
      wrap.style.display = kind.value === "sub" ? "block" : "none";
    };

    kind.addEventListener("change", update);
    update();
  });
}

function initProductsTab() {
  populateCategorySelects();
  loadAdminProducts();

  const addProductBtn = document.getElementById("add-product-btn");
  const formContainer = document.getElementById("add-product-form");
  const saveBtn = document.getElementById("save-product-btn");

  if (addProductBtn) {
    addProductBtn.addEventListener("click", () => {
      if (formContainer.style.display === "none") {
        formContainer.style.display = "block";
        addProductBtn.innerText = "إلغاء";
        addProductBtn.style.background = "#ef4444";
      } else {
        formContainer.style.display = "none";
        addProductBtn.innerText = "إضافة منتج جديد";
        addProductBtn.style.background = "#10b981";
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const name = document.getElementById("new-product-name").value;
      const price = document.getElementById("new-product-price").value;
      const category = document.getElementById("new-product-category").value;
      const imageInput = document.getElementById("new-product-image");
      const imageFile = imageInput.files[0];

      if (!name || !price || !category || !imageFile) {
        alert("يرجى ملء جميع الحقول واختيار صورة!");
        return;
      }

      saveBtn.innerText = "جاري الحفظ...";
      saveBtn.disabled = true;

      compressImageFile(imageFile, function (compressedBase64) {
    if(!compressedBase64) {
      if (typeof saveBtn !== 'undefined' && saveBtn) { saveBtn.innerText = "إضافة منتج جديد"; saveBtn.disabled = false; }
      if (typeof updateBtn !== 'undefined' && updateBtn) { updateBtn.innerText = "حفظ التعديلات"; updateBtn.disabled = false; }
      if (typeof addBannerBtn !== 'undefined' && addBannerBtn) { addBannerBtn.innerText = "إضافة بنر جديد"; addBannerBtn.disabled = false; }
      return;
    }
        try {
          let products = [];
          try {
            const saved = localStorage.getItem("products");
            if (saved) products = JSON.parse(saved);
          } catch (e) {}

          if (!products) {
            products = [];
          }

          const newId =
            products.length > 0
              ? Math.max(...products.map((p) => p.id)) + 1
              : 1;
          const formattedPrice =
            parseInt(price).toLocaleString("en-US") + " د.ع";

          const newProduct = {
            id: newId,
            name: name,
            price: formattedPrice,
            image: compressedBase64,
            rating: 5,
            category: category,
          };

          products.push(newProduct);
          localStorage.setItem("products", JSON.stringify(products));
          syncItemToFirestore("products", newProduct, "add");

          document.getElementById("new-product-name").value = "";
          document.getElementById("new-product-price").value = "";
          document.getElementById("new-product-image").value = "";
          formContainer.style.display = "none";
          addProductBtn.innerText = "إضافة منتج جديد";
          addProductBtn.style.background = "#10b981";

          alert("تمت إضافة المنتج بنجاح!");
          loadAdminProducts();
        } catch (err) {
          console.error(err);
          alert("خطأ! مساحة التخزين ممتلئة.");
        } finally {
          saveBtn.innerText = "حفظ المنتج";
          saveBtn.disabled = false;
        }
      });
    });
  }
}

function loadAdminProducts() {
  const container = document.getElementById("admin-products-container");
  if (!container) return;

  // Attach edit events once if not attached
  if (!window.editEventsAttached) {
    const cancelBtn = document.getElementById("cancel-edit-btn");
    const updateBtn = document.getElementById("update-product-btn");

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        document.getElementById("edit-product-form").style.display = "none";
      });
    }

    if (updateBtn) {
      updateBtn.addEventListener("click", () => {
        const id = parseInt(document.getElementById("edit-product-id").value);
        const name = document.getElementById("edit-product-name").value;
        const price = document.getElementById("edit-product-price").value;
        const category = document.getElementById("edit-product-category").value;
        const imageInput = document.getElementById("edit-product-image");
        const imageFile = imageInput.files[0];

        if (!name || !price || !category) {
          alert("يرجى ملء كافة الحقول الأساسية!");
          return;
        }

        let products = JSON.parse(localStorage.getItem("products")) || [];

        const formattedPrice = parseInt(price).toLocaleString("en-US") + " د.ع";
        const index = products.findIndex((p) => p.id === id);

        if (index !== -1) {
          products[index].name = name;
          products[index].price = formattedPrice;
          products[index].category = category;

          if (imageFile) {
            updateBtn.innerText = "جاري الحفظ...";
            updateBtn.disabled = true;
            compressImageFile(imageFile, function (compressedBase64) {
    if(!compressedBase64) {
      if (typeof saveBtn !== 'undefined' && saveBtn) { saveBtn.innerText = "إضافة منتج جديد"; saveBtn.disabled = false; }
      if (typeof updateBtn !== 'undefined' && updateBtn) { updateBtn.innerText = "حفظ التعديلات"; updateBtn.disabled = false; }
      if (typeof addBannerBtn !== 'undefined' && addBannerBtn) { addBannerBtn.innerText = "إضافة بنر جديد"; addBannerBtn.disabled = false; }
      return;
    }
              products[index].image = compressedBase64;
              try {
                localStorage.setItem("products", JSON.stringify(products));
                syncItemToFirestore("products", products[index], "update");
                document.getElementById("edit-product-form").style.display =
                  "none";
                loadAdminProducts();
                alert("تم التعديل بنجاح!");
              } catch (err) {
                console.error(err);
                alert("خطأ! مساحة التخزين ممتلئة.");
              } finally {
                updateBtn.innerText = "حفظ التعديلات";
                updateBtn.disabled = false;
              }
            });
          } else {
            try {
              localStorage.setItem("products", JSON.stringify(products));
              syncItemToFirestore("products", products[index], "update");
              document.getElementById("edit-product-form").style.display =
                "none";
              loadAdminProducts();
              alert("تم التعديل بنجاح!");
            } catch (err) {
              console.error(err);
              alert("خطأ! مساحة التخزين ممتلئة.");
            }
          }
        }
      });
    }
    window.editEventsAttached = true;
  }

  let products = JSON.parse(localStorage.getItem("products")) || [];

  container.innerHTML = "";

  if (products.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted); grid-column: 1 / -1;">لا توجد منتجات.</div>';
    return;
  }

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "order-card"; // نستخدم نفس كارد ستايل الطلبات للاختصار والشكل الجميل
    card.innerHTML = `
            <div style="display:flex; gap: 1rem; align-items: center; margin-bottom: 1rem;">
                <img src="${product.image || IMAGE_FALLBACK_URL}" onerror="recoverBunnyImage(this)" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
                <div>
                    <h4 style="color: var(--primary); margin-bottom: 0.25rem;">${product.name}</h4>
                    <div style="color: var(--text-main); font-weight: 600;">${product.price}</div>
                    <div style="color: var(--text-muted); font-size: 0.85rem; margin-top:0.25rem;">الفئة: ${getCategoryName(product.category)}</div>
                </div>
            </div>
            <div class="order-actions" style="margin-top: auto;">
                <button class="btn btn-accept edit-product-btn" data-id="${product.id}" style="background: var(--primary);">تعديل</button>
                <button class="btn btn-reject delete-product-btn" data-id="${product.id}">حذف</button>
            </div>
        `;
    container.appendChild(card);
  });

  const editBtns = container.querySelectorAll(".edit-product-btn");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      if (typeof window.editProduct === "function") window.editProduct(id);
    });
  });

  const deleteBtns = container.querySelectorAll(".delete-product-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = parseInt(e.currentTarget.getAttribute("data-id"));
      if (typeof window.deleteProduct === "function") window.deleteProduct(id);
    });
  });
}

function getCategoryName(id) {
  if (id === "all") return "الكل";
  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  const cat = categories.find((c) => c.id === id);
  return cat ? cat.name : id;
}

window.deleteProduct = function (id) {
  let products = JSON.parse(localStorage.getItem("products")) || [];

  const productToDelete = products.find((p) => p.id === id);
  products = products.filter((p) => p.id !== id);
  localStorage.setItem("products", JSON.stringify(products));
  if (productToDelete) {
    syncItemToFirestore("products", productToDelete, "delete");
  }

  loadAdminProducts();
};

window.editProduct = function (id) {
  let products = JSON.parse(localStorage.getItem("products")) || [];

  const product = products.find((p) => p.id === id);
  if (!product) return;

  document.getElementById("edit-product-id").value = product.id;
  document.getElementById("edit-product-name").value = product.name;
  const priceNum = product.price.replace(/[^\d]/g, "");
  document.getElementById("edit-product-price").value = priceNum;
  document.getElementById("edit-product-category").value = product.category;
  document.getElementById("edit-product-image").value = "";

  document.getElementById("edit-product-form").style.display = "block";
  document
    .getElementById("edit-product-form")
    .scrollIntoView({ behavior: "smooth", block: "center" });
};

// ------------------------------------
// قسم إدارة البنرات
// ------------------------------------

function compressImageFile(file, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 600; // تصغير الحجم لتجنب مشاكل التخزين
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        
        // تحويل الصورة الى نص Base64 مضغوط جداً
        const base64String = canvas.toDataURL("image/jpeg", 0.6);
        callback(base64String);
      } catch (err) {
        console.error("Compression error:", err);
        alert("حدث خطأ أثناء ضغط الصورة");
        callback(null);
      }
    };
    img.onerror = function () {
      alert("الملف المرفق غير صالح كصورة");
      callback(null);
    };
    img.src = e.target.result;
  };
  reader.onerror = function () {
    alert("فشل في قراءة الصورة.");
    callback(null);
  };
  reader.readAsDataURL(file);
}

async function uploadImageToBunny(file, folder = "uploads") {
  const extension = getImageExtension(file);
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const filePath = `${folder}/${safeName}`;
  const uploadUrl = `${BUNNY_STORAGE_ENDPOINT}/${filePath}`;

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: BUNNY_ACCESS_KEY,
      "Content-Type": file.type || `image/${extension}`,
    },
    body: file,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Bunny upload failed: ${response.status} ${errorText}`);
  }

  return `https://${BUNNY_CDN_HOST}/${filePath}`;
}

function getImageExtension(file) {
  const extension = (file.name.split(".").pop() || "").toLowerCase();
  const allowed = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

  if (allowed.includes(extension)) {
    return extension === "jpeg" ? "jpg" : extension;
  }

  if (file.type && file.type.startsWith("image/")) {
    return file.type.replace("image/", "").replace("jpeg", "jpg");
  }

  return "jpg";
}

function compressImageFile(file, callback) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    alert("الملف المرفق غير صالح كصورة");
    callback(null);
    return;
  }

  uploadImageToBunny(file)
    .then((imageUrl) => callback(imageUrl))
    .catch((err) => {
      console.error("Bunny upload error:", err);
      alert("فشل رفع الصورة إلى Bunny CDN. تأكد من مفتاح الوصول واسم منطقة التخزين.");
      callback(null);
    });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

function compressImageFile(file, callback) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    alert("الملف المرفق غير صالح كصورة");
    callback(null);
    return;
  }

  uploadImageToBunny(file)
    .then((imageUrl) => callback(imageUrl))
    .catch(async (err) => {
      console.error("Bunny upload error:", err);
      try {
        const fallbackImage = await fileToDataUrl(file);
        alert("تعذر رفع الصورة إلى Bunny بسبب بيانات الوصول. تم حفظ الصورة مؤقتا داخل التطبيق إلى أن نعدل بيانات Bunny.");
        callback(fallbackImage);
      } catch (readError) {
        console.error("Image fallback error:", readError);
        alert("فشل رفع الصورة إلى Bunny وفشل حفظها محليا.");
        callback(null);
      }
    });
}

function compressImageFile(file, callback) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    alert("الملف المرفق غير صالح كصورة");
    callback(null);
    return;
  }

  uploadImageToBunny(file)
    .then((imageUrl) => callback(imageUrl))
    .catch((err) => {
      console.error("Bunny upload error:", err);
      alert("فشل رفع الصورة إلى Bunny. لن يتم حفظ المنتج بدون رابط الصورة.");
      callback(null);
    });
}

function initBannersTab() {
  loadAdminBanners();

  const addBannerBtn = document.getElementById("add-banner-btn");
  const formContainer = document.getElementById("add-banner-form");
  const saveBtn = document.getElementById("save-banner-btn");

  if (addBannerBtn) {
    addBannerBtn.addEventListener("click", () => {
      if (formContainer.style.display === "none") {
        formContainer.style.display = "block";
        addBannerBtn.innerText = "إلغاء";
        addBannerBtn.style.background = "#ef4444";
      } else {
        formContainer.style.display = "none";
        addBannerBtn.innerText = "إضافة بنر جديد";
        addBannerBtn.style.background = "#10b981";
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const imageInput = document.getElementById("new-banner-image");
      const imageFile = imageInput.files[0];

      if (!imageFile) {
        alert("يرجى اختيار صورة للبنر!");
        return;
      }

      saveBtn.innerText = "جاري الحفظ...";
      saveBtn.disabled = true;

      compressImageFile(imageFile, function (compressedBase64) {
    if(!compressedBase64) {
      if (typeof saveBtn !== 'undefined' && saveBtn) { saveBtn.innerText = "إضافة منتج جديد"; saveBtn.disabled = false; }
      if (typeof updateBtn !== 'undefined' && updateBtn) { updateBtn.innerText = "حفظ التعديلات"; updateBtn.disabled = false; }
      if (typeof addBannerBtn !== 'undefined' && addBannerBtn) { addBannerBtn.innerText = "إضافة بنر جديد"; addBannerBtn.disabled = false; }
      return;
    }
        if (!compressedBase64) {
          saveBtn.innerText = "حفظ البنر";
          saveBtn.disabled = false;
          return;
        }
        try {
          let banners = [];
          const saved = localStorage.getItem("banners");
          if (saved) {
            banners = JSON.parse(saved);
          } else {
            banners = [];
          }

          banners.push(compressedBase64);
          localStorage.setItem("banners", JSON.stringify(banners));

          if (window.db && window.firestore) {
            window.firestore
              .setDoc(window.firestore.doc(window.db, "meta", "banners"), {
                data: banners,
              })
              .then(() => updateAdminCacheVersion())
              .catch((e) => console.error("Error saving banners:", e));
          }

          document.getElementById("new-banner-image").value = "";
          formContainer.style.display = "none";
          addBannerBtn.innerText = "إضافة بنر جديد";
          addBannerBtn.style.background = "#10b981";

          alert("تمت إضافة البنر بنجاح!");
          loadAdminBanners();
        } catch (error) {
          console.error(error);
          alert(
            "خطأ أثناء الحفظ! مساحة التخزين ممتلئة. حاول حذف بعض البنرات القديمة أو المنتجات.",
          );
        } finally {
          saveBtn.innerText = "حفظ البنر";
          saveBtn.disabled = false;
        }
      });
    });
  }
}

function loadAdminBanners() {
  const container = document.getElementById("admin-banners-container");
  if (!container) return;

  let banners = [];
  const saved = localStorage.getItem("banners");
  if (saved) {
    try {
      banners = JSON.parse(saved);
    } catch (e) {
      banners = [];
    }
  } else {
    banners = [];
  }

  container.innerHTML = "";

  // Check if banners count is now really 0 (if user manually emptied the fallback)
  if (banners.length === 0) {
    container.innerHTML =
      '<div style="text-align:center; padding: 3rem; color:var(--text-muted);">لا توجد بنرات حالياً.</div>';
    return;
  }

  banners.forEach((bannerUrl, index) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.style.display = "flex";
    card.style.flexDirection = "row";
    card.style.alignItems = "center";
    card.style.justifyContent = "space-between";

    card.innerHTML = `
            <img src="${bannerUrl || IMAGE_FALLBACK_URL}" onerror="recoverBunnyImage(this)" style="height: 100px; width: auto; max-width: 70%; object-fit: cover; border-radius: 8px;">
            <div class="order-actions" style="margin: 0; min-width: 100px;">
                <button class="btn btn-reject delete-banner-btn" data-index="${index}">حذف</button>
            </div>
        `;
    container.appendChild(card);
  });

  const deleteBtns = container.querySelectorAll(".delete-banner-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(e.currentTarget.getAttribute("data-index"));
      if (typeof window.deleteBanner === "function") {
        window.deleteBanner(index);
      } else {
        alert("خطأ: دالة الحذف غير موجودة!");
      }
    });
  });
}

window.deleteBanner = function (index) {
  try {
    let banners = [];
    const saved = localStorage.getItem("banners");
    if (saved) {
      try {
        banners = JSON.parse(saved);
      } catch (e) {
        banners = [];
      }
    } else {
      banners = [];
    }

    if (index >= 0 && index < banners.length) {
      banners.splice(index, 1);
      try {
        // نستخدم [] للحفظ إذا تم حذف كل البنرات عشان ميرجعوش الافتراضيين
        localStorage.setItem("banners", JSON.stringify(banners));
        if (window.db && window.firestore) {
          window.firestore
            .setDoc(window.firestore.doc(window.db, "meta", "banners"), {
              data: banners,
            })
            .then(() => updateAdminCacheVersion())
            .catch((e) => console.error("Error saving banners:", e));
        }
      } catch (e) {
        console.error(e);
        alert("خطأ أثناء تحديث المساحة كأنها ممتلئة! التفاصيل: " + e.message);
        return;
      }
    }

    loadAdminBanners();
  } catch (error) {
    alert("خطأ أثناء الحذف: " + error.message);
    console.error(error);
  }
};

// Categories functions
function initCategoriesTab() {
  const addCategoryBtn = document.getElementById("add-category-btn");
  const addCategoryForm = document.getElementById("add-category-form");
  const saveCategoryBtn = document.getElementById("save-category-btn");
  populateParentCategorySelects();
  setupCategoryKindControls();

  if (addCategoryBtn && addCategoryForm) {
    addCategoryBtn.addEventListener("click", () => {
      const isVisible = addCategoryForm.style.display === "block";
      addCategoryForm.style.display = isVisible ? "none" : "block";
      addCategoryBtn.innerText = isVisible
        ? "إضافة فئة جديدة"
        : "إلغاء الإضافة";
      if (!isVisible) {
        document.getElementById("edit-category-form").style.display = "none";
      }
    });
  }

  if (saveCategoryBtn) {
    saveCategoryBtn.addEventListener("click", () => {
      const name = document.getElementById("new-category-name").value.trim();
      const imageFile = document.getElementById("new-category-image").files[0];
      const categoryKind = document.getElementById("new-category-kind")?.value || "main";
      const parentId = document.getElementById("new-category-parent")?.value || "";

      if (!name) {
        alert("يرجى إدخال اسم الفئة.");
        return;
      }

      if (categoryKind === "sub" && !parentId) {
        alert("اختر الفئة الرئيسية التابعة لها.");
        return;
      }

      const id = "cat_" + Date.now();

      saveCategoryBtn.innerText = "جاري الحفظ...";
      saveCategoryBtn.disabled = true;

      const handleSave = (imgUrl) => {
        let categories = JSON.parse(localStorage.getItem("categories")) || [];

        const newCat = { id, name, image: imgUrl };
        if (categoryKind === "sub") {
          newCat.parentId = parentId;
        }
        categories.push(newCat);
        try {
          localStorage.setItem("categories", JSON.stringify(categories));
          syncItemToFirestore("categories", newCat, "add");

          document.getElementById("new-category-name").value = "";
          document.getElementById("new-category-image").value = "";
          document.getElementById("new-category-kind").value = "main";
          document.getElementById("new-parent-category-wrap").style.display = "none";
          addCategoryForm.style.display = "none";
          addCategoryBtn.innerText = "إضافة فئة جديدة";

          loadAdminCategories();
          populateParentCategorySelects();
        } catch (e) {
          alert("المساحة ممتلئة! يرجى حذف بعض العناصر.");
        }
        saveCategoryBtn.innerText = "حفظ الفئة";
        saveCategoryBtn.disabled = false;
      };

      if (imageFile) {
        compressImageFile(imageFile, (url) => {
    if(!url) { saveCategoryBtn.innerText = "حفظ الفئة"; saveCategoryBtn.disabled = false; return; }
    handleSave(url);
  });
      } else {
        handleSave("https://cdn-icons-png.flaticon.com/512/149/149852.png"); // صورة افتراضية
      }
    });
  }

  const cancelEditBtn = document.getElementById("cancel-category-edit-btn");
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      document.getElementById("edit-category-form").style.display = "none";
    });
  }

  const updateBtn = document.getElementById("update-category-btn");
  if (updateBtn) {
    const updateCategoryBtn = updateBtn;
    updateBtn.addEventListener("click", () => {
      const originalId = document.getElementById(
        "edit-category-original-id",
      ).value;
      const name = document.getElementById("edit-category-name").value.trim();
      const imageFile = document.getElementById("edit-category-image").files[0];
      const categoryKind = document.getElementById("edit-category-kind")?.value || "main";
      const parentId = document.getElementById("edit-category-parent")?.value || "";

      if (!name) {
        alert("يرجى إدخال اسم الفئة.");
        return;
      }

      let categories = JSON.parse(localStorage.getItem("categories")) || [];

      const catIndex = categories.findIndex((c) => c.id === originalId);
      if (catIndex === -1) return;

      if (categoryKind === "sub" && !parentId) {
        alert("اختر الفئة الرئيسية التابعة لها.");
        return;
      }

      updateBtn.innerText = "جاري التحديث...";
      updateBtn.disabled = true;

      const handleUpdate = (imgUrl) => {
        categories[catIndex].name = name;
        if (categoryKind === "sub") {
          categories[catIndex].parentId = parentId;
        } else {
          delete categories[catIndex].parentId;
        }
        if (imgUrl) {
          categories[catIndex].image = imgUrl;
        }

        try {
          localStorage.setItem("categories", JSON.stringify(categories));
          syncItemToFirestore("categories", categories[catIndex], "update");
          document.getElementById("edit-category-form").style.display = "none";
          loadAdminCategories();
        } catch (e) {
          alert("حدث خطأ أثناء الحفظ.");
        }
        updateBtn.innerText = "حفظ التعديلات";
        updateBtn.disabled = false;
      };

      if (imageFile) {
        compressImageFile(imageFile, (url) => {
    if(!url) { updateCategoryBtn.innerText = "تحديث الفئة"; updateCategoryBtn.disabled = false; return; }
    handleUpdate(url);
  });
      } else {
        handleUpdate(null);
      }
    });
  }

  loadAdminCategories();
}

function loadAdminCategories() {
  if (typeof populateCategorySelects === "function") populateCategorySelects();

  const container = document.getElementById("admin-categories-container");
  if (!container) return;

  let categories = JSON.parse(localStorage.getItem("categories")) || [];

  container.innerHTML = "";

  if (categories.length === 0) {
    container.innerHTML =
      '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">لا توجد فئات حالياً.</div>';
    return;
  }

  categories.forEach((cat) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.style.display = "flex";
    card.style.flexDirection = "column";
    const parent = cat.parentId ? categories.find((item) => item.id === cat.parentId) : null;
    const categoryTypeLabel = parent ? `فرعية ضمن: ${parent.name}` : "فئة رئيسية";

    card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <img src="${cat.image || IMAGE_FALLBACK_URL}" onerror="recoverBunnyImage(this)" style="width: 50px; height: 50px; object-fit: contain; background: #f8f9fa; border-radius: 8px; padding: 5px;">
                <div>
                    <h3 style="margin-bottom: 0.25rem;">${cat.name}</h3>
                    <span style="display:block; color: var(--primary); font-size: 0.85rem; font-weight: 700; margin-bottom: 0.2rem;">${categoryTypeLabel}</span>
                    <span style="color: var(--text-muted); font-size: 0.9rem;">معرف: ${cat.id}</span>
                </div>
            </div>
            <div class="order-actions" style="margin-top: auto;">
                <button class="btn btn-accept edit-category-btn" data-id="${cat.id}" style="background: var(--primary);">تعديل</button>
                <button class="btn btn-reject delete-category-btn" data-id="${cat.id}">حذف</button>
            </div>
        `;
    container.appendChild(card);
  });

  const editBtns = container.querySelectorAll(".edit-category-btn");
  editBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (typeof window.editCategory === "function") window.editCategory(id);
    });
  });

  const deleteBtns = container.querySelectorAll(".delete-category-btn");
  deleteBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.currentTarget.getAttribute("data-id");
      if (typeof window.deleteCategory === "function")
        window.deleteCategory(id);
    });
  });
}

window.editCategory = function (id) {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];
  
  const cat = categories.find((c) => c.id === id);
  if (!cat) return;

  document.getElementById("edit-category-original-id").value = cat.id;
  document.getElementById("edit-category-name").value = cat.name;
  document.getElementById("edit-category-image").value = "";
  populateParentCategorySelects();
  const editKind = document.getElementById("edit-category-kind");
  const editParent = document.getElementById("edit-category-parent");
  const editParentWrap = document.getElementById("edit-parent-category-wrap");
  if (editParent) {
    const selfOption = editParent.querySelector(`option[value="${cat.id}"]`);
    if (selfOption) selfOption.remove();
  }
  if (editKind) editKind.value = cat.parentId ? "sub" : "main";
  if (editParent) editParent.value = cat.parentId || "";
  if (editParentWrap) editParentWrap.style.display = cat.parentId ? "block" : "none";

  document.getElementById("add-category-form").style.display = "none";
  document.getElementById("add-category-btn").innerText = "إضافة فئة جديدة";

  const editForm = document.getElementById("edit-category-form");
  editForm.style.display = "block";
  editForm.scrollIntoView({ behavior: "smooth" });
};

window.deleteCategory = function (id) {
  let categories = JSON.parse(localStorage.getItem("categories")) || [];

  const categoryToDelete = categories.find((c) => c.id === id);
  const childCategories = categories.filter((c) => c.parentId === id);
  categories = categories.filter((c) => c.id !== id && c.parentId !== id);

  try {
    localStorage.setItem("categories", JSON.stringify(categories));
    if (categoryToDelete) {
      syncItemToFirestore("categories", categoryToDelete, "delete");
    }
    childCategories.forEach((child) => syncItemToFirestore("categories", child, "delete"));
    loadAdminCategories();
  } catch (e) {
    alert("خطأ أثناء الحذف!");
  }
};

function initSettingsTab() {
  const deliveryCostInput = document.getElementById("delivery-cost-input");
  const saveDeliveryCostBtn = document.getElementById("save-delivery-cost-btn");

  if (deliveryCostInput) {
    deliveryCostInput.value = localStorage.getItem("deliveryCost") || "3000";
  }
  if (saveDeliveryCostBtn) {
    saveDeliveryCostBtn.addEventListener("click", () => {
      const cost = deliveryCostInput.value;
      localStorage.setItem("deliveryCost", cost);
      alert("تم حفظ كلفة التوصيل بنجاح");
    });
  }
}
