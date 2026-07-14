(function () {
  if (!new URLSearchParams(window.location.search).has("clearData")) return;

  function showStatus(message) {
    let box = document.getElementById("clear-data-status");
    if (!box) {
      box = document.createElement("div");
      box.id = "clear-data-status";
      box.style.cssText = "position:fixed;inset:20px;z-index:99999;background:#fff;border:1px solid #d1d5db;border-radius:12px;padding:20px;font-family:Cairo,Arial,sans-serif;direction:rtl;box-shadow:0 20px 50px rgba(15,23,42,.16);white-space:pre-wrap";
      document.body.appendChild(box);
    }
    box.textContent = message;
  }

  async function clearCollection(collectionName) {
    if (!window.db || !window.firestore) return 0;

    const snapshot = await window.firestore.getDocs(
      window.firestore.collection(window.db, collectionName),
    );
    let deleted = 0;

    for (const docSnap of snapshot.docs) {
      await window.firestore.deleteDoc(docSnap.ref);
      deleted += 1;
    }

    return deleted;
  }

  async function clearData() {
    showStatus("جاري حذف المنتجات والفئات...");
    const result = {
      productsDeleted: 0,
      categoriesDeleted: 0,
      errors: [],
    };

    try {
      window.localStorage.setItem("products", "[]");
      window.localStorage.setItem("categories", "[]");
      window.localStorage.removeItem("metaVersion");
    } catch (error) {
      result.errors.push(error.message);
    }

    try {
      result.productsDeleted = await clearCollection("products");
      result.categoriesDeleted = await clearCollection("categories");
      await window.firestore.setDoc(
        window.firestore.doc(window.db, "meta", "version"),
        { updatedAt: window.firestore.serverTimestamp() },
      );
    } catch (error) {
      result.errors.push(error.message);
    }

    window.__adminClearDataResult = result;
    showStatus(
      `تمت عملية الحذف\nالمنتجات المحذوفة: ${result.productsDeleted}\nالفئات المحذوفة: ${result.categoriesDeleted}\nالأخطاء: ${result.errors.length ? result.errors.join(" | ") : "لا يوجد"}`,
    );
    window.dispatchEvent(new CustomEvent("adminDataCleared", { detail: result }));
  }

  if (window.db && window.firestore) {
    clearData();
  } else {
    window.addEventListener("firebaseReady", clearData, { once: true });
  }
})();
