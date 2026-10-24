// Sample data for a neighbourhood grocery shop (hanout).
// Everything is generated from a fixed seed, so the numbers are the same on every visit.

const SHOP = {
  name: 'Hanout Al Baraka',
  city: 'Ben Slimane',
  opens: 8,   // 08:00
  closes: 22, // last hour starts at 21:00
};

// price in dirhams, stock on the shelf now, reorder point, how often it sells
const PRODUCTS = [
  { id: 'bread',    name: 'Bread (khobz)',         cat: 'Bakery',     price: 1.5,  stock: 34, reorder: 40, pop: 30 },
  { id: 'msemen',   name: 'Msemen',                cat: 'Bakery',     price: 2,    stock: 22, reorder: 15, pop: 12 },
  { id: 'milk',     name: 'Milk 1 L',              cat: 'Dairy',      price: 7,    stock: 18, reorder: 24, pop: 22 },
  { id: 'lben',     name: 'Lben 1 L',              cat: 'Dairy',      price: 6.5,  stock: 30, reorder: 12, pop: 9 },
  { id: 'yogurt',   name: 'Yogurt pack (4)',       cat: 'Dairy',      price: 9,    stock: 26, reorder: 10, pop: 10 },
  { id: 'cheese',   name: 'Cheese portions',       cat: 'Dairy',      price: 14,   stock: 15, reorder: 6,  pop: 5 },
  { id: 'eggs',     name: 'Eggs (6)',              cat: 'Dairy',      price: 9,    stock: 8,  reorder: 12, pop: 12 },
  { id: 'tea',      name: 'Green tea 200 g',       cat: 'Pantry',     price: 18,   stock: 21, reorder: 8,  pop: 8 },
  { id: 'sugar',    name: 'Sugar cone 2 kg',       cat: 'Pantry',     price: 16,   stock: 6,  reorder: 10, pop: 9 },
  { id: 'oil',      name: 'Sunflower oil 1 L',     cat: 'Pantry',     price: 19,   stock: 14, reorder: 10, pop: 8 },
  { id: 'olive',    name: 'Olive oil 1 L',         cat: 'Pantry',     price: 65,   stock: 9,  reorder: 4,  pop: 2 },
  { id: 'couscous', name: 'Couscous 1 kg',         cat: 'Pantry',     price: 15,   stock: 19, reorder: 8,  pop: 5 },
  { id: 'flour',    name: 'Flour 2 kg',            cat: 'Pantry',     price: 17,   stock: 4,  reorder: 8,  pop: 5 },
  { id: 'lentils',  name: 'Lentils 1 kg',          cat: 'Pantry',     price: 20,   stock: 12, reorder: 6,  pop: 3 },
  { id: 'tomato',   name: 'Tomato paste',          cat: 'Pantry',     price: 6,    stock: 40, reorder: 15, pop: 7 },
  { id: 'sardines', name: 'Sardines tin',          cat: 'Pantry',     price: 7,    stock: 28, reorder: 12, pop: 6 },
  { id: 'water',    name: 'Water 1.5 L',           cat: 'Drinks',     price: 6,    stock: 48, reorder: 24, pop: 18 },
  { id: 'soda',     name: 'Soda 1 L',              cat: 'Drinks',     price: 10,   stock: 11, reorder: 18, pop: 11 },
  { id: 'juice',    name: 'Orange juice 1 L',      cat: 'Drinks',     price: 14,   stock: 16, reorder: 8,  pop: 4 },
  { id: 'coffee',   name: 'Coffee 250 g',          cat: 'Drinks',     price: 30,   stock: 10, reorder: 5,  pop: 3 },
  { id: 'soap',     name: 'Soap bar',              cat: 'Household',  price: 5,    stock: 25, reorder: 10, pop: 4 },
  { id: 'detergent',name: 'Laundry powder 1 kg',   cat: 'Household',  price: 24,   stock: 3,  reorder: 6,  pop: 3 },
  { id: 'tissues',  name: 'Tissues pack',          cat: 'Household',  price: 8,    stock: 20, reorder: 8,  pop: 4 },
  { id: 'chips',    name: 'Crisps',                cat: 'Snacks',     price: 3,    stock: 55, reorder: 20, pop: 14 },
  { id: 'biscuits', name: 'Biscuits',              cat: 'Snacks',     price: 4,    stock: 9,  reorder: 20, pop: 13 },
  { id: 'chocolate',name: 'Chocolate bar',         cat: 'Snacks',     price: 6,    stock: 31, reorder: 12, pop: 7 },
];

const CATEGORIES = [...new Set(PRODUCTS.map((p) => p.cat))];

// Small seeded random generator (mulberry32)
function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How busy each weekday is (0 = Sunday) and each opening hour
const DAY_FACTOR = [1.15, 0.9, 0.85, 0.9, 0.95, 1.2, 1.3];
const HOUR_FACTOR = { 8: 0.9, 9: 0.8, 10: 0.6, 11: 0.6, 12: 0.9, 13: 1.0, 14: 0.6, 15: 0.5, 16: 0.6, 17: 0.9, 18: 1.3, 19: 1.5, 20: 1.2, 21: 0.7 };

function poisson(rand, mean) {
  const l = Math.exp(-mean);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > l);
  return k - 1;
}

// 90 full days of transactions, ending yesterday
function generateSales(days = 90) {
  const rand = seeded(20251024);
  const totalPop = PRODUCTS.reduce((s, p) => s + p.pop, 0);
  const pick = () => {
    let r = rand() * totalPop;
    for (const p of PRODUCTS) { r -= p.pop; if (r <= 0) return p; }
    return PRODUCTS[0];
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sales = [];

  for (let d = days; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    // a slow upward trend over the period
    const trend = 0.97 + 0.06 * ((days - d) / days);
    for (let h = SHOP.opens; h < SHOP.closes; h++) {
      const n = poisson(rand, 5.2 * DAY_FACTOR[date.getDay()] * HOUR_FACTOR[h] * trend);
      for (let i = 0; i < n; i++) {
        const lines = new Map();
        const count = 1 + Math.floor(rand() * rand() * 5);
        for (let j = 0; j < count; j++) {
          const p = pick();
          const qty = p.id === 'bread' ? 2 + Math.floor(rand() * 5) : 1 + (rand() < 0.15 ? 1 : 0);
          lines.set(p.id, (lines.get(p.id) || 0) + qty);
        }
        sales.push({ date, day: date.getDay(), hour: h, lines: [...lines] });
      }
    }
  }
  return sales;
}

const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const SALES = generateSales();
