#!/usr/bin/env python3
"""
Natural Earth 50m ülke sınırlarından oyunun data.js dosyasını üretir.

Kullanım (proje klasöründen):
    python3 tools/build_data.py

Girdi : raw/ne_50m_admin_0_countries.geojson  (Natural Earth, public domain)
Çıktı : data.js  ->  const COUNTRIES = [...]; const WORLD_BG = [...];
"""
import json
import math
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "raw", "ne_50m_admin_0_countries.geojson")
OUT = os.path.join(ROOT, "data.js")

R = 6371.0088  # km

# ---------------------------------------------------------------- tablolar
EXTRA_INCLUDE = {"CUB", "KAZ", "AUS", "CHN", "DNK", "FIN", "FRA", "GBR", "NLD",
                 "NZL", "USA", "ISR", "KOS", "PSX", "SAH", "GRL", "PRI"}
MERGE = {"SOL": "SOM", "CYN": "CYP"}  # Somaliland -> Somali, KKTC -> Kıbrıs (adanın tamamı)
SKIP = {"KAS", "ATA"}

NAME_OVERRIDE = {
    "CHN": "Çin", "TWN": "Tayvan", "ZAF": "Güney Afrika", "CZE": "Çekya",
    "CYP": "Kıbrıs", "COG": "Kongo", "BLR": "Belarus", "SWZ": "Esvatini",
    "USA": "Amerika Birleşik Devletleri", "GBR": "Birleşik Krallık",
}
ALIASES = {
    "USA": ["ABD", "Amerika"], "GBR": ["İngiltere", "UK"], "ARE": ["BAE"],
    "CZE": ["Çek Cumhuriyeti"], "COD": ["Kongo DC", "Zaire"], "COG": ["Kongo Cumhuriyeti"],
    "BLR": ["Beyaz Rusya"], "MKD": ["Makedonya"], "SWZ": ["Svaziland"], "MMR": ["Burma"],
    "CIV": ["Fildişi"], "TLS": ["Timor", "Timor-Leste"], "CPV": ["Cabo Verde"],
    "CYP": ["KKTC", "Kıbrıs Cumhuriyeti", "Kuzey Kıbrıs"], "CHN": ["Çin Halk Cumhuriyeti"],
    "TWN": ["Çin Cumhuriyeti"], "ZAF": ["Güney Afrika Cumhuriyeti"], "NLD": ["Holanda", "Felemenk"],
    "PRK": ["K. Kore"], "KOR": ["G. Kore"], "BIH": ["Bosna"], "VAT": ["Vatikan"],
    "TUR": ["Turkiye"], "SAH": ["Western Sahara"], "LKA": ["Seylan"], "IRN": ["Persia"],
    "KAZ": ["Kazakhistan"], "GRL": ["Greenland"],
}

CAPITALS = {
    "AFG": "Kabil", "AGO": "Luanda", "ALB": "Tiran", "AND": "Andorra la Vella", "ARE": "Abu Dabi",
    "ARG": "Buenos Aires", "ARM": "Erivan", "ATG": "Saint John's", "AUT": "Viyana", "AZE": "Bakü",
    "BDI": "Gitega", "BEL": "Brüksel", "BEN": "Porto-Novo", "BFA": "Vagadugu", "BGD": "Dakka",
    "BGR": "Sofya", "BHR": "Manama", "BHS": "Nassau", "BIH": "Saraybosna", "BLR": "Minsk",
    "BLZ": "Belmopan", "BOL": "Sucre", "BRA": "Brasília", "BRB": "Bridgetown",
    "BRN": "Bandar Seri Begawan", "BTN": "Thimphu", "BWA": "Gaborone", "CAF": "Bangui",
    "CAN": "Ottawa", "CHE": "Bern", "CHL": "Santiago", "CIV": "Yamusukro", "CMR": "Yaoundé",
    "COD": "Kinşasa", "COG": "Brazzaville", "COL": "Bogota", "COM": "Moroni", "CPV": "Praia",
    "CRI": "San José", "CYP": "Lefkoşa", "CZE": "Prag", "DEU": "Berlin", "DJI": "Cibuti",
    "DMA": "Roseau", "DOM": "Santo Domingo", "DZA": "Cezayir", "ECU": "Quito", "EGY": "Kahire",
    "ERI": "Asmara", "ESP": "Madrid", "EST": "Tallinn", "ETH": "Addis Ababa", "FJI": "Suva",
    "FSM": "Palikir", "GAB": "Libreville", "GEO": "Tiflis", "GHA": "Akra", "GIN": "Konakri",
    "GMB": "Banjul", "GNB": "Bissau", "GNQ": "Malabo", "GRC": "Atina", "GRD": "Saint George's",
    "GTM": "Guatemala", "GUY": "Georgetown", "HND": "Tegucigalpa", "HRV": "Zagreb",
    "HTI": "Port-au-Prince", "HUN": "Budapeşte", "IDN": "Cakarta", "IND": "Yeni Delhi",
    "IRL": "Dublin", "IRN": "Tahran", "IRQ": "Bağdat", "ISL": "Reykjavik", "ITA": "Roma",
    "JAM": "Kingston", "JOR": "Amman", "JPN": "Tokyo", "KEN": "Nairobi", "KGZ": "Bişkek",
    "KHM": "Phnom Penh", "KIR": "Güney Tarawa", "KNA": "Basseterre", "KOR": "Seul",
    "KWT": "Kuveyt", "LAO": "Vientiane", "LBN": "Beyrut", "LBR": "Monrovia", "LBY": "Trablus",
    "LCA": "Castries", "LIE": "Vaduz", "LKA": "Kolombo", "LSO": "Maseru", "LTU": "Vilnius",
    "LUX": "Lüksemburg", "LVA": "Riga", "MAR": "Rabat", "MCO": "Monako", "MDA": "Kişinev",
    "MDG": "Antananarivo", "MDV": "Male", "MEX": "Meksiko", "MHL": "Majuro", "MKD": "Üsküp",
    "MLI": "Bamako", "MLT": "Valletta", "MMR": "Neypyido", "MNE": "Podgorica",
    "MNG": "Ulan Batur", "MOZ": "Maputo", "MRT": "Nouakchott", "MUS": "Port Louis",
    "MWI": "Lilongwe", "MYS": "Kuala Lumpur", "NAM": "Windhoek", "NER": "Niamey",
    "NGA": "Abuja", "NIC": "Managua", "NOR": "Oslo", "NPL": "Katmandu", "NRU": "Yaren",
    "OMN": "Maskat", "PAK": "İslamabad", "PAN": "Panama", "PER": "Lima", "PHL": "Manila",
    "PLW": "Ngerulmud", "PNG": "Port Moresby", "POL": "Varşova", "PRK": "Pyongyang",
    "PRT": "Lizbon", "PRY": "Asunción", "QAT": "Doha", "ROU": "Bükreş", "RUS": "Moskova",
    "RWA": "Kigali", "SAU": "Riyad", "SDN": "Hartum", "SDS": "Juba", "SEN": "Dakar",
    "SGP": "Singapur", "SLB": "Honiara", "SLE": "Freetown", "SLV": "San Salvador",
    "SMR": "San Marino", "SOM": "Mogadişu", "SRB": "Belgrad", "STP": "São Tomé",
    "SUR": "Paramaribo", "SVK": "Bratislava", "SVN": "Ljubljana", "SWE": "Stockholm",
    "SWZ": "Mbabane", "SYC": "Victoria", "SYR": "Şam", "TCD": "Encemine", "TGO": "Lome",
    "THA": "Bangkok", "TJK": "Duşanbe", "TKM": "Aşkabat", "TLS": "Dili", "TON": "Nuku'alofa",
    "TTO": "Port of Spain", "TUN": "Tunus", "TUR": "Ankara", "TUV": "Funafuti",
    "TWN": "Taipei", "TZA": "Dodoma", "UGA": "Kampala", "UKR": "Kiev", "URY": "Montevideo",
    "UZB": "Taşkent", "VAT": "Vatikan", "VCT": "Kingstown", "VEN": "Karakas", "VNM": "Hanoi",
    "VUT": "Port Vila", "WSM": "Apia", "YEM": "Sana", "ZAF": "Pretoria", "ZMB": "Lusaka",
    "ZWE": "Harare", "CUB": "Havana", "KAZ": "Astana", "AUS": "Kanberra", "CHN": "Pekin",
    "DNK": "Kopenhag", "FIN": "Helsinki", "FRA": "Paris", "GBR": "Londra", "NLD": "Amsterdam",
    "NZL": "Wellington", "USA": "Washington", "ISR": "Kudüs", "KOS": "Priştine",
    "PSX": "Ramallah", "SAH": "El Ayun", "GRL": "Nuuk", "PRI": "San Juan",
}

CONTINENT_TR = {
    "Africa": "Afrika", "Asia": "Asya", "Europe": "Avrupa", "North America": "Kuzey Amerika",
    "South America": "Güney Amerika", "Oceania": "Okyanusya",
}
CONTINENT_FIX = {"MDV": "Asia", "MUS": "Africa", "SYC": "Africa"}
CONTINENT_LABEL_FIX = {"RUS": "Avrupa / Asya", "TUR": "Asya / Avrupa", "CYP": "Asya (Avrupa'ya yakın)"}

SUBREGION_TR = {
    "Northern Europe": "Kuzey Avrupa", "Western Europe": "Batı Avrupa",
    "Southern Europe": "Güney Avrupa", "Eastern Europe": "Doğu Avrupa",
    "Western Asia": "Batı Asya", "Central Asia": "Orta Asya", "Southern Asia": "Güney Asya",
    "Eastern Asia": "Doğu Asya", "South-Eastern Asia": "Güneydoğu Asya",
    "Northern Africa": "Kuzey Afrika", "Western Africa": "Batı Afrika",
    "Middle Africa": "Orta Afrika", "Eastern Africa": "Doğu Afrika",
    "Southern Africa": "Güney Afrika", "Northern America": "Kuzey Amerika",
    "Central America": "Orta Amerika", "Caribbean": "Karayipler", "South America": "Güney Amerika",
    "Australia and New Zealand": "Avustralya ve Yeni Zelanda", "Melanesia": "Melanezya",
    "Micronesia": "Mikronezya", "Polynesia": "Polinezya",
}
# Avrupa modunda oynanabilecek, kıtası 'Europe' olmayan ülkeler
EUROPE_EXTRA = {"TUR", "CYP"}

POOL_MIN_AREA = 5000      # km² — bundan küçük ülkeler günlük havuza girmez
POOL_EXCLUDE = {"KIR", "MHL", "FSM", "TUV", "NRU", "PLW", "MDV", "SYC", "TON",
                "PSX", "SAH", "GRL", "PRI"}
POOL_FORCE = {"LUX"}  # küçük ama karada, silüeti tanınabilir  # tartışmalı / bağımlı / dağınık takımadalar
MAINLAND_GAP_KM = 300     # anakaraya zincirleme bu mesafeden yakın parçalar silüete dahil
MAINLAND_MANUAL_DROP = {  # (ülke, koşul) — elle ayıklanan uzak parçalar
    "NOR": lambda lat, lon: lat > 74,           # Svalbard, Bjørnøya
    "RUS": lambda lat, lon: 19 < lon < 23 and lat < 56,  # Kaliningrad
}


# ---------------------------------------------------------------- geometri
def ring_area_km2(ring):
    """Küresel yaklaşık alan (Chamberlain–Duquette)."""
    if len(ring) < 3:
        return 0.0
    s = 0.0
    n = len(ring)
    for i in range(n):
        lon1, lat1 = ring[i]
        lon2, lat2 = ring[(i + 1) % n]
        dl = math.radians(lon2 - lon1)
        if dl > math.pi:
            dl -= 2 * math.pi
        elif dl < -math.pi:
            dl += 2 * math.pi
        s += dl * (2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2)))
    return abs(s * R * R / 2.0)


def poly_area(poly):
    a = ring_area_km2(poly[0])
    for h in poly[1:]:
        a -= ring_area_km2(h)
    return max(a, 0.0)


def haversine(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def sample(ring, k=60):
    step = max(1, len(ring) // k)
    return ring[::step]


def bbox(poly):
    xs = [p[0] for p in poly[0]]
    ys = [p[1] for p in poly[0]]
    return min(xs), min(ys), max(xs), max(ys)


def bbox_gap_km(a, b):
    """Kutular arası alt sınır mesafe (hızlı eleme için)."""
    dy = max(0, max(a[1], b[1]) - min(a[3], b[3])) * 111.2
    dx = max(0, max(a[0], b[0]) - min(a[2], b[2]))
    lat = max(abs(a[1]), abs(a[3]), abs(b[1]), abs(b[3]))
    dx *= 111.2 * math.cos(math.radians(min(lat, 89)))
    return math.hypot(dx, dy)


def poly_gap_km(a, b):
    """İki poligon arasındaki yaklaşık en kısa mesafe (dış halkalardan örnekleyerek)."""
    best = float("inf")
    sa, sb = sample(a[0]), sample(b[0])
    for lon1, lat1 in sa:
        for lon2, lat2 in sb:
            d = haversine(lat1, lon1, lat2, lon2)
            if d < best:
                best = d
    return best


def to_xyz(lon, lat):
    la, lo = math.radians(lat), math.radians(lon)
    return (math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la))


def centroid(polys):
    """Alan ağırlıklı merkez: her poligonun düzlemsel merkezi (yerel projeksiyonda)
    3B birim vektöre çevrilip alanıyla ağırlıklandırılır."""
    X = Y = Z = 0.0
    for poly in polys:
        ring = poly[0]
        lat0 = sum(p[1] for p in ring) / len(ring)
        lon0 = ring[0][0]
        c = math.cos(math.radians(lat0))
        pts = []
        for lon, lat in ring:
            dl = lon - lon0
            if dl > 180:
                dl -= 360
            elif dl < -180:
                dl += 360
            pts.append((dl * c, lat))
        A = cx = cy = 0.0
        for i in range(len(pts)):
            x1, y1 = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            cr = x1 * y2 - x2 * y1
            A += cr
            cx += (x1 + x2) * cr
            cy += (y1 + y2) * cr
        if abs(A) < 1e-12:
            continue
        cx /= 3 * A
        cy /= 3 * A
        lon = lon0 + cx / c
        lat = cy
        w = poly_area(poly)
        x, y, z = to_xyz(lon, lat)
        X += x * w
        Y += y * w
        Z += z * w
    lon = math.degrees(math.atan2(Y, X))
    lat = math.degrees(math.atan2(Z, math.hypot(X, Y)))
    return round(lat, 3), round(lon, 3)


def dp_simplify(pts, tol):
    if len(pts) < 4:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        s, e = stack.pop()
        ax, ay = pts[s]
        bx, by = pts[e]
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        idx, dmax = -1, 0.0
        for i in range(s + 1, e):
            px, py = pts[i]
            if L == 0:
                d = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / L
                t = max(0, min(1, t))
                d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d > dmax:
                idx, dmax = i, d
        if dmax > tol * tol and idx > 0:
            keep[idx] = True
            stack.append((s, idx))
            stack.append((idx, e))
    return [p for p, k in zip(pts, keep) if k]


def simplify_ring(ring, tol, decimals):
    out = dp_simplify(ring, tol)
    res = []
    for lon, lat in out:
        p = (round(lon, decimals), round(lat, decimals))
        if not res or res[-1] != p:
            res.append(p)
    if len(res) > 1 and res[0] == res[-1]:
        res.pop()
    return res


def flat(ring, decimals):
    out = []
    for lon, lat in ring:
        out.append(round(lon, decimals))
        out.append(round(lat, decimals))
    return out


def flag_emoji(a2):
    if not a2 or len(a2) != 2 or not a2.isalpha():
        return "🏳️"
    return "".join(chr(0x1F1E6 + ord(c) - ord("A")) for c in a2.upper())


def get_polys(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return list(geom["coordinates"])


def select_mainland(code, polys):
    areas = [poly_area(p) for p in polys]
    order = sorted(range(len(polys)), key=lambda i: -areas[i])
    main = order[0]
    drop = MAINLAND_MANUAL_DROP.get(code)
    kept = {main}
    frontier = [main]
    cand = set(order[1:])
    if drop:
        for i in list(cand):
            lon, lat = polys[i][0][0]
            if drop(lat, lon):
                cand.discard(i)
    boxes = [bbox(p) for p in polys]
    # antimeridyeni geçen ülkeler (Rusya, Fiji…): batı yarıküre kutularını +360 kaydır
    if any(b[0] < -150 for b in boxes) and any(b[2] > 150 for b in boxes):
        boxes = [(b[0] + 360, b[1], b[2] + 360, b[3]) if b[2] < 0 else b for b in boxes]
    while frontier:
        cur = frontier.pop()
        for i in list(cand):
            if bbox_gap_km(boxes[cur], boxes[i]) > MAINLAND_GAP_KM:
                continue
            if poly_gap_km(polys[cur], polys[i]) <= MAINLAND_GAP_KM:
                cand.discard(i)
                kept.add(i)
                frontier.append(i)
    return sorted(kept), areas


# ---------------------------------------------------------------- ana akış
def main():
    data = json.load(open(SRC, encoding="utf-8"))
    feats = {}
    bg = []
    for f in data["features"]:
        p = f["properties"]
        a3 = p["ADM0_A3"]
        if a3 in SKIP:
            continue
        playable = p["TYPE"] in ("Sovereign country", "Sovereignty") or a3 in EXTRA_INCLUDE or a3 in MERGE
        if not playable:
            bg.append(f)
            continue
        target = MERGE.get(a3, a3)
        feats.setdefault(target, {"props": None, "polys": []})
        if a3 == target:
            feats[target]["props"] = p
        feats[target]["polys"].extend(get_polys(f["geometry"]))

    countries = []
    for code, entry in sorted(feats.items()):
        p = entry["props"]
        polys = entry["polys"]
        mainland_idx, areas = select_mainland(code, polys)
        mainland = [polys[i] for i in mainland_idx]
        lat, lon = centroid(mainland)
        total_area = sum(areas)
        main_area = sum(areas[i] for i in mainland_idx)

        # bounding box (derece) — tolerans ülke boyutuna göre
        lons = [pt[0] for poly in mainland for pt in poly[0]]
        lats = [pt[1] for poly in mainland for pt in poly[0]]
        span = max(max(lats) - min(lats), (max(lons) - min(lons)) * math.cos(math.radians(lat)))
        if span > 300:  # antimeridyeni geçenler
            span = 60
        tol = min(0.04, max(0.0015, span * 0.0018))
        dec = 3 if span < 8 else 2

        out_polys = []
        out_main = []
        for i, poly in enumerate(polys):
            is_main = i in mainland_idx
            t = tol if is_main else max(tol, 0.03)
            rings = []
            for j, ring in enumerate(poly):
                sr = simplify_ring(ring, t, dec)
                if len(sr) < 3:
                    continue
                if not is_main and j > 0:
                    continue
                rings.append(flat(sr, dec))
            if not rings:
                continue
            # küçük, anakara dışı adacıkları dünya haritasında da atla
            if not is_main and areas[i] < 30 and total_area > 2000:
                continue
            if is_main:
                out_main.append(len(out_polys))
            out_polys.append(rings)

        cont_en = CONTINENT_FIX.get(code, p["CONTINENT"])
        name = NAME_OVERRIDE.get(code, p["NAME_TR"])
        a2 = p["ISO_A2_EH"] if p["ISO_A2_EH"] not in ("-99", None) else p["ISO_A2"]
        if code == "KOS":
            a2 = "XK"
        europe = cont_en == "Europe" or code in EUROPE_EXTRA
        pool = ((main_area >= POOL_MIN_AREA) and code not in POOL_EXCLUDE) or code in POOL_FORCE
        countries.append({
            "id": code,
            "n": name,
            "al": ALIASES.get(code, []) + ([p["NAME_TR"]] if p["NAME_TR"] != name else []),
            "en": p["NAME_EN"],
            "f": flag_emoji(a2),
            "c": CONTINENT_LABEL_FIX.get(code, CONTINENT_TR.get(cont_en, cont_en)),
            "sr": SUBREGION_TR.get(p["SUBREGION"], p["SUBREGION"]),
            "cap": CAPITALS.get(code, ""),
            "lat": lat, "lon": lon,
            "a": round(main_area),
            "eu": europe,
            "pool": pool,
            "m": out_main,
            "p": out_polys,
        })
        if not CAPITALS.get(code):
            print("UYARI: başkent yok ->", code, name)

    # arka plan (oynanamayan bağımlı topraklar) — sadece dünya haritası için, kaba
    bg_out = []
    for f in bg:
        for poly in get_polys(f["geometry"]):
            if poly_area(poly) < 200:
                continue
            sr = simplify_ring(poly[0], 0.05, 2)
            if len(sr) >= 3:
                bg_out.append(flat(sr, 2))

    js = ("// Otomatik üretildi: tools/build_data.py — Natural Earth 50m (public domain)\n"
          "// p: poligonlar [[dış halka, delikler...]] düz [lon,lat,...] dizileri; m: anakara poligon indeksleri\n"
          "const COUNTRIES = " + json.dumps(countries, ensure_ascii=False, separators=(",", ":")) + ";\n"
          "const WORLD_BG = " + json.dumps(bg_out, separators=(",", ":")) + ";\n")
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(js)
    print(f"{len(countries)} ülke, havuz: dünya={sum(c['pool'] for c in countries)}, "
          f"avrupa={sum(c['pool'] and c['eu'] for c in countries)}; "
          f"data.js = {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
