let menuData = null;
let selectedCat = 'ALL';
let searchQuery = '';

// Helper para asegurar que las rutas de imágenes sean relativas
function resolveAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // Quitar cualquier barra inicial para que el base tag o la ruta relativa resuelva adecuadamente
  return url.replace(/^\/+/, '');
}

// 1. Detectar parámetro ?mesa=X
const urlParams = new URLSearchParams(window.location.search);
const mesaParam = urlParams.get('mesa');
if (mesaParam) {
  const badge = document.getElementById('mesaBadge');
  const numSpan = document.getElementById('mesaNum');
  if (badge && numSpan) {
    numSpan.textContent = mesaParam.replace(/^Mesa\s*/i, '');
    badge.style.display = 'inline-block';
  }
}

// 2. Cargar datos desde data/menu.json con cache busting
async function loadMenu() {
  const loadingEl = document.getElementById('loading');
  const menuContainer = document.getElementById('menuContainer');

  try {
    const res = await fetch('data/menu.json?t=' + Date.now());
    if (!res.ok) throw new Error('Error HTTP ' + res.status);
    menuData = await res.json();
    renderCategories();
    renderProducts();
    if (loadingEl) loadingEl.style.display = 'none';
    if (menuContainer) menuContainer.style.display = 'block';
  } catch (err) {
    console.error('Error al cargar la carta:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="empty-state">
          <p>No se pudo cargar la carta digital en este momento.</p>
          <p style="font-size: 0.8rem; margin-top: 8px;">Por favor, consulte al mozo en su mesa.</p>
        </div>
      `;
    }
  }
}

function renderCategories() {
  const bar = document.getElementById('categoriesBar');
  if (!bar || !menuData || !menuData.categories) return;

  let html = `<button class="cat-btn ${selectedCat === 'ALL' ? 'active' : ''}" onclick="setCategory('ALL')">Todos (${menuData.totalProducts || 0})</button>`;
  menuData.categories.forEach(cat => {
    const count = cat.products ? cat.products.length : 0;
    html += `<button class="cat-btn ${selectedCat === cat.id ? 'active' : ''}" onclick="setCategory('${cat.id}')">${cat.name} (${count})</button>`;
  });
  bar.innerHTML = html;
}

window.setCategory = function(catId) {
  selectedCat = catId;
  renderCategories();
  renderProducts();
};

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderProducts();
  });
}

function renderProducts() {
  const container = document.getElementById('menuContainer');
  if (!container || !menuData || !menuData.categories) return;

  let categoriesToRender = menuData.categories;
  if (selectedCat !== 'ALL') {
    categoriesToRender = categoriesToRender.filter(c => c.id === selectedCat);
  }

  let html = '';
  let totalVisible = 0;

  categoriesToRender.forEach(cat => {
    const filteredProds = (cat.products || []).filter(p => {
      if (!searchQuery) return true;
      const matchName = p.name && p.name.toLowerCase().includes(searchQuery);
      const matchDesc = p.description && p.description.toLowerCase().includes(searchQuery);
      return matchName || matchDesc;
    });

    if (filteredProds.length > 0) {
      // Ordenar productos exclusivamente dentro de cada categoría: MENOR A MAYOR PRECIO, con orden secundario por nombre
      const sortedProds = [...filteredProds].sort((a, b) => {
        const priceA = Number(a.priceInCents ?? 0);
        const priceB = Number(b.priceInCents ?? 0);
        if (priceA !== priceB) {
          return priceA - priceB;
        }
        return (a.name || '').localeCompare(b.name || '');
      });

      totalVisible += sortedProds.length;
      html += `<div class="section-title">${cat.name}</div>`;
      html += `<div class="products-grid">`;

      sortedProds.forEach(p => {
        const rawThumb = p.thumbnailUrl || p.imageUrl;
        const thumbSrc = resolveAssetUrl(rawThumb);
        const fullImg = resolveAssetUrl(p.imageUrl || p.thumbnailUrl);

        const placeholderHtml = `<div class="card-img-placeholder"><img src="assets/logo.jpeg" alt="El Patio" style="width:44px; height:44px; object-fit:contain; opacity:0.35;"></div>`;

        const imgHtml = thumbSrc
          ? `<img class="card-img" src="${thumbSrc}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';">${placeholderHtml.replace('class="card-img-placeholder"', 'class="card-img-placeholder" style="display:none;"')}`
          : placeholderHtml;

        // Serializar de forma segura para atributo onclick
        const escapedProd = JSON.stringify(p).replace(/"/g, '&quot;');
        const safeFullImg = fullImg.replace(/'/g, "\\'");
        const safeName = (p.name || '').replace(/'/g, "\\'");

        const imgBoxOnClick = fullImg
          ? `onclick="event.stopPropagation(); openLightbox('${safeFullImg}', '${safeName}')" title="Toca para ver la imagen completa"`
          : '';

        html += `
          <div class="card" onclick="openModal(${escapedProd})">
            <div class="card-img-box" ${imgBoxOnClick}>
              ${imgHtml}
              ${fullImg ? '<span class="card-zoom-badge" title="Ver foto">🔍</span>' : ''}
            </div>
            <div class="card-body">
              <div>
                <h3 class="card-title">${p.name}</h3>
                <p class="card-desc">${p.description || 'Consulte detalles con el mozo.'}</p>
              </div>
              <div class="card-footer">
                <span class="card-price">${p.priceFormatted}</span>
                <span class="card-badge">Ver detalle ›</span>
              </div>
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }
  });

  if (totalVisible === 0) {
    html = `
      <div class="empty-state">
        <p>No encontramos platos o bebidas que coincidan con la búsqueda.</p>
      </div>
    `;
  }

  container.innerHTML = html;
}

let currentModalProd = null;

window.openModal = function(prod) {
  currentModalProd = prod;
  const titleEl = document.getElementById('modalTitle');
  const priceEl = document.getElementById('modalPrice');
  const descEl = document.getElementById('modalDesc');
  const imgEl = document.getElementById('modalImg');
  const fallbackEl = document.getElementById('modalImgFallback');
  const zoomBtn = document.getElementById('modalZoomBtn');
  const modal = document.getElementById('productModal');

  if (titleEl) titleEl.textContent = prod.name;
  if (priceEl) priceEl.textContent = prod.priceFormatted;
  if (descEl) descEl.textContent = prod.description || 'Consulte ingredientes y opciones disponibles con el personal de servicio.';

  const fullImg = resolveAssetUrl(prod.imageUrl || prod.thumbnailUrl);

  if (imgEl && fallbackEl) {
    if (fullImg) {
      imgEl.src = fullImg;
      imgEl.alt = prod.name;
      imgEl.style.display = 'block';
      fallbackEl.style.display = 'none';
      if (zoomBtn) zoomBtn.style.display = 'inline-flex';
      imgEl.onerror = () => {
        imgEl.style.display = 'none';
        fallbackEl.style.display = 'flex';
        if (zoomBtn) zoomBtn.style.display = 'none';
      };
    } else {
      imgEl.style.display = 'none';
      fallbackEl.style.display = 'flex';
      if (zoomBtn) zoomBtn.style.display = 'none';
    }
  }

  if (modal) modal.classList.add('open');
};

window.openLightbox = function(imgSrc, title) {
  if (!imgSrc) return;
  const lightbox = document.getElementById('imageLightbox');
  const lbImg = document.getElementById('lightboxImg');
  const lbTitle = document.getElementById('lightboxTitle');

  if (lbImg) {
    lbImg.src = imgSrc;
    lbImg.alt = title || 'Fotografía de producto';
  }
  if (lbTitle) {
    lbTitle.textContent = title || '';
    lbTitle.style.display = title ? 'block' : 'none';
  }
  if (lightbox) {
    lightbox.classList.add('open');
  }
};

window.openLightboxFromModal = function() {
  if (!currentModalProd) return;
  const fullImg = resolveAssetUrl(currentModalProd.imageUrl || currentModalProd.thumbnailUrl);
  if (fullImg) {
    window.openLightbox(fullImg, currentModalProd.name);
  }
};

window.closeLightbox = function(event) {
  if (event) {
    event.stopPropagation();
  }
  const lightbox = document.getElementById('imageLightbox');
  if (lightbox) {
    lightbox.classList.remove('open');
  }
};

window.closeModal = function() {
  const modal = document.getElementById('productModal');
  if (modal) modal.classList.remove('open');
  currentModalProd = null;
  window.closeLightbox();
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const lightbox = document.getElementById('imageLightbox');
    if (lightbox && lightbox.classList.contains('open')) {
      window.closeLightbox();
    } else {
      window.closeModal();
    }
  }
});

// Iniciar carga del menú
loadMenu();
