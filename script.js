let lang = document.documentElement.lang || "sv";
let geoJson;
let map;
let legend;
let markers = [];
let activeFilter = null;

window.onload = async () => {
    map = L.map("map", {
        attributionControl: true
    }).setView([20, 0], 2);

    const bounds = L.latLngBounds(
        L.latLng(-60, -180),
        L.latLng(85, 220)
    );
    map.setMaxBounds(bounds);
    map.on('drag', function () {
        map.panInsideBounds(bounds, { animate: false });
    });

    map.attributionControl.setPrefix('');

    const baseLayers = {
        "Vector": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: '<a href="https://openstreetmap.org">Open Street Map</a> contributors & <a href="https://carto.com">CARTO</a>',
            maxZoom: 10,
            minZoom: 2
        }),
        "Satellite": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            attribution: 'Powered by <a href="https://esri.com">Esri</a> & Maxar',
            maxZoom: 10,
            minZoom: 2
        })
    };

    var originalInitTile = L.GridLayer.prototype._initTile;
    L.GridLayer.include({
        _initTile: function (tile) {
            originalInitTile.call(this, tile);
            var tileSize = this.getTileSize();
            tile.style.width = tileSize.x + 1 + 'px';
            tile.style.height = tileSize.y + 1 + 'px';
        }
    });

    let currentLayer = baseLayers["Vector"];
    currentLayer.addTo(map);

    const toggleButton = document.getElementById("layer-toggle");
    toggleButton.addEventListener("click", () => {
        map.removeLayer(currentLayer);
        currentLayer = currentLayer === baseLayers["Vector"] ? baseLayers["Satellite"] : baseLayers["Vector"];
        currentLayer.addTo(map);
        toggleButton.classList.toggle("satellite-layer");
        toggleButton.classList.toggle("vector-layer");
    });

    const toggleLanguage = document.getElementById("language-toggle");
    toggleLanguage.checked = true;
    toggleLanguage.addEventListener("change", function () {
        lang = this.checked ? "sv" : "en";
        updateLegend();
        updatePopups();
    });

    const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vS2u6o3JqE0iBmRhimpqE-jhebkHiBrayRnsbfHk6xs5X3zjqqUlPTPQFECu_wQVGxnKCqHNJyMWsAs/pub?output=csv");
    const csvData = await response.text();
    const parsed = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true
    });

    geoJson = {
        type: "FeatureCollection",
        features: parsed.data.map(row => {
            if (!row.lat || !row.long) return null;
            return {
                type: "Feature",
                properties: row,
                geometry: {
                    type: "Point",
                    coordinates: [parseFloat(row.long), parseFloat(row.lat)]
                }
            };
        }).filter(Boolean)
    };

    createMarkers();
    updateLegend();

    map.on("popupopen", (e) => {
        const marker = e.popup._source;
        const zoom = map.getZoom();
        map.setView(marker.getLatLng(), zoom < 5 ? 5 : zoom, { animate: true });
    });
};

const translations = {
    en: { Binda: "REMOVE", Forebygga: "PREVENT", Minska: "REDUCE" },
    sv: { Binda: "BINDA", Forebygga: "FÖREBYGGA", Minska: "MINSKA" }
};

const legendLabels = (type) => translations[lang]?.[type] || type;

const icons = {
    Binda: L.icon({ iconUrl: "assets/binda.png", iconSize: [30, 30] }),
    Forebygga: L.icon({ iconUrl: "assets/forebygga.png", iconSize: [30, 30] }),
    Minska: L.icon({ iconUrl: "assets/minska.png", iconSize: [30, 30] })
};

const sdgNames = {
    "1" : "No Poverty", "2" : "Zero Hunger", "3" : "Good Health & Wellbeing", "4" : "Quality Education", "5" : "Gender Equality", "6" : "Clean Water & Sanitation", "7" : "Affordable & Clean Energy", "8" : "Decent Work & Economic Growth", "9" : "Industry, Innovation & Infrastructure", "10" : "Reduced Inequalities", "11" : "Sustainable Cities & Communities", "12" : "Responsible Consumption & Production", "13" : "Climate Action", "14" : "Life Below Water", "15" : "Life on Land", "16" : "Peace, Justice & Strong Institutions", "17" : "Partnerships for the Goals"
};

function createMarkers() {
    if (markers.length > 0) return;

    geoJson.features.forEach(feature => {
        const latlng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
        const marker = L.marker(latlng, { icon: icons[feature.properties.type_sv] });
        marker.feature = feature;
        marker.addTo(map);
        markers.push(marker);
    });

    updatePopups();
}

function updateLegend() {
    if (legend) map.removeControl(legend);

    legend = L.control({ position: "bottomleft" });
    legend.onAdd = () => {
        const div = L.DomUtil.create("div", "legend");

        const types = ["Binda", "Forebygga", "Minska"];
        div.innerHTML = types.map(type => `
            <div class="legend-item" data-type="${type}">
                <img src="assets/${type.toLowerCase()}.png" width="30" height="30">
                <span>${legendLabels(type)}</span>
            </div>
        `).join("");

        return div;
    };
    legend.addTo(map);

    document.querySelectorAll(".legend-item").forEach(item => {
        const type = item.dataset.type;
        if (type === activeFilter) {
            item.classList.add("active");
        }
        item.addEventListener("click", () => {
            toggleTypeFilter(type);
        });
    });
}

function toggleTypeFilter(type) {
    if (activeFilter === type) {
        activeFilter = null;
    } else {
        activeFilter = type;
    }

    markers.forEach(marker => {
        const markerType = marker.feature.properties.type_sv;
        if (!activeFilter || markerType === activeFilter) {
            marker.addTo(map);
        } else {
            map.removeLayer(marker);
        }
    });

    document.querySelectorAll(".legend-item").forEach(item => {
        item.classList.toggle("active", item.dataset.type === activeFilter);
    });
}

function updatePopups() {
    markers.forEach(marker => {
        const feature = marker.feature;
        const name = lang === "sv" ? feature.properties.name_sv : feature.properties.name_en;
        const description = lang === "sv" ? feature.properties.description_sv : feature.properties.description_en;

        const image = feature.properties.image || "assets/default.webp";

        const sdgs = feature.properties.sdgs ? feature.properties.sdgs.split(",").map(s => s.trim()) : [];
        const sdgIconsHtml = buildSdgIconsHtml(sdgs);

        function buildSdgIconsHtml(sdgs) {
            return sdgs.map((sdg, i) => {
                const imgHtml = `<img src="assets/SDG${sdg}.png"
                    alt="SDG ${sdg}"
                    title="${sdgNames[sdg] || `SDG ${sdg}`}" />`;
                    if (sdgs.length === 6 && i === 3) {
                        return `<span>${imgHtml}</span><span class="flex-break"></span>`;
                    }
                    return `<span>${imgHtml}</span>`;
            }).join("");
        }

        let link = feature.properties.link;

        if (lang === "en") {
            const url = new URL(link);
            if (!url.pathname.startsWith("/en/")) {
                url.pathname = `/en${url.pathname}`;
            }
            link = url.toString();
        }

        marker.bindPopup(
            `<div class="customPopup">
                <div class="popupImage">
                <img src=${image} alt=${name}>
                    <div class="popupText">
                        <a href=${link} target="_blank"><b>${name}</b></a><br>
                        <span>${description}</span>
                    </div>
                    ${sdgIconsHtml ? `<div class="popupSDGs">${sdgIconsHtml}</div>` : ""}
                </div>
            </div>`
        );
    });

}
