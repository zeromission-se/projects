window.onload = async () => {
        const map = L.map("map").setView([20, 0], 2);
           
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

        const lang = document.documentElement.lang || "sv";

        const translations = {
            en: { Binda: "Remove", Forebygga: "Prevent", Minska: "Reduce" },
            sv: { Binda: "Binda", Forebygga: "Förebygga", Minska: "Minska" }
        };

        const getTitle = (type) => translations[lang]?.[type] || type;

        const customIcons = {
            Binda: L.icon({ iconUrl: "https://zeromission.se/wp-content/uploads/2025/04/binda.png", iconSize: [30, 30] }),
            Forebygga: L.icon({ iconUrl: "https://zeromission.se/wp-content/uploads/2025/04/forebygga.png", iconSize: [30, 30] }),
            Minska: L.icon({ iconUrl: "https://zeromission.se/wp-content/uploads/2025/04/minska.png", iconSize: [30, 30] })
        };

        try {
            const response = await fetch("https://docs.google.com/spreadsheets/d/e/2PACX-1vRRsHUvw--BsVFBa-DuEDmfuVxq8W_h9Q-FbK-DcCYcq6544MMdkMcLegh5xFpUV5xt_wDijSCrqN4f/pub?output=csv");
            if (!response.ok) throw new Error("Failed to load CSV");

            const csvData = await response.text();
            const [headerRow, ...dataRows] = csvData.trim().split("\n");
            const headers = headerRow.split(",").map(h => h.trim());

            const geoJson = {
                type: "FeatureCollection",
                features: dataRows.map(row => {
                    const values = row.split(",").map(v => v.trim());
                    if (values.length !== headers.length) return null;
                    const props = Object.fromEntries(headers.map((h, i) => [h, values[i]]));

                    return {
                        type: "Feature",
                        properties: props,
                        geometry: {
                            type: "Point",
                            coordinates: [parseFloat(props.long), parseFloat(props.lat)]
                        }
                    };
                }).filter(Boolean)
            };

            L.geoJSON(geoJson, {
                pointToLayer: (feature, latlng) => L.marker(latlng, { icon: customIcons[feature.properties.type_sv] }),
                onEachFeature: (feature, layer) => {
                    if (feature.properties) {
                        const name = lang === "sv" ? feature.properties.name_sv : feature.properties.name_en;
                        const description = lang === "sv" ? feature.properties.description_sv : feature.properties.description_en;
                        layer.bindPopup(`<div class="customPopup"><a href=${feature.properties.link} target="_blank"><b>${name}</b></a><br>${description}</div>`);
                    }
                }
            }).addTo(map);

            map.on("popupopen", (e) => {
                const marker = e.popup._source;
                const zoom = map.getZoom();
                map.setView(marker.getLatLng(), zoom < 5 ? 5 : zoom, { animate: true });
            });

            const legend = L.control({ position: "bottomleft" });
            legend.onAdd = () => {
                const div = L.DomUtil.create("div", "legend");
                div.innerHTML = `
                    <img src="https://zeromission.se/wp-content/uploads/2025/04/binda.png" width="20"> ${getTitle("Binda")}<br>
                    <img src="https://zeromission.se/wp-content/uploads/2025/04/forebygga.png" width="20"> ${getTitle("Forebygga")}<br>
                    <img src="https://zeromission.se/wp-content/uploads/2025/04/minska.png" width="20"> ${getTitle("Minska")}<br>
                `;
                return div;
            };
            legend.addTo(map);

        } catch (error) {
            console.error("Error:", error);
        }
    };
