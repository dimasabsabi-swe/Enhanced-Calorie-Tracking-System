/**
 * ============================================================================
 * Enhanced Calorie Tracking System (ECTS) — Application Logic
 * SWE 401 · Phase 5 Implementation Prototype
 * ----------------------------------------------------------------------------
 * Architecture (layered, mirrors the class design from earlier phases):
 *
 *   1. CONFIG            – app-wide constants
 *   2. FOOD_DATABASE     – static nutrition reference data
 *   3. Utilities         – DateUtil, Validator, Format helpers
 *   4. Data layer        – Storage (localStorage wrapper),
 *                          UserRepository, MealRepository
 *   5. Service layer     – Auth, FoodService, Nutrition, MealService
 *   6. Demo seed         – populates a demo account + two weeks of meals
 *   7. UI layer          – view renderers for each screen + shared UI helpers
 *   8. Router            – hash-based navigation with an auth guard
 *   9. Bootstrap         – wires events and starts the app
 *
 * No backend, no external APIs: everything persists in localStorage.
 * The pure logic (services/utilities) is exposed on window.ECTS so the
 * automated test runner (tests/test-runner.html) can exercise it.
 * ============================================================================
 */
(function () {
  'use strict';

  /* ==========================================================================
     1. CONFIG
     ========================================================================== */
  const CONFIG = Object.freeze({
    // Tests set window.ECTS_STORAGE_PREFIX so they never touch real app data.
    STORAGE_PREFIX: window.ECTS_STORAGE_PREFIX || 'ects.',
    DEFAULT_GOAL: 2000,
    MIN_GOAL: 1000,
    MAX_GOAL: 5000,
    // Default macronutrient split (share of daily calories)
    MACRO_SPLIT: { protein: 0.25, carbs: 0.5, fat: 0.25 },
    KCAL_PER_GRAM: { protein: 4, carbs: 4, fat: 9 },
    MEAL_TYPES: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
    USER_TYPES: ['Standard User', 'Premium User', 'Athlete', 'Dietitian'],
    SERVING_STEP: 0.5,
    MAX_SERVINGS: 10,
    DEMO_ACCOUNT: { email: 'demo@ects.app', password: 'demo123' }
  });

  /* ==========================================================================
     2. FOOD DATABASE
     Values are approximate per listed serving and are intended for
     demonstration only. Fields: calories (kcal), macros in grams.
     ========================================================================== */
  const FOOD_DATABASE = Object.freeze([
    // Fruits
    { id: 'apple', name: 'Apple', category: 'Fruits', serving: '1 medium (182 g)', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, fiber: 4.4, sugar: 19 },
    { id: 'banana', name: 'Banana', category: 'Fruits', serving: '1 medium (118 g)', calories: 105, protein: 1.3, carbs: 27, fat: 0.4, fiber: 3.1, sugar: 14 },
    { id: 'orange', name: 'Orange', category: 'Fruits', serving: '1 medium (131 g)', calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2, fiber: 3.1, sugar: 12 },
    { id: 'dates', name: 'Medjool Dates', category: 'Fruits', serving: '3 pieces (72 g)', calories: 200, protein: 1.3, carbs: 54, fat: 0.1, fiber: 4.8, sugar: 48 },
    { id: 'strawberries', name: 'Strawberries', category: 'Fruits', serving: '1 cup (152 g)', calories: 49, protein: 1, carbs: 11.7, fat: 0.5, fiber: 3, sugar: 7.4 },
    { id: 'avocado', name: 'Avocado', category: 'Fruits', serving: '½ fruit (100 g)', calories: 160, protein: 2, carbs: 8.5, fat: 14.7, fiber: 6.7, sugar: 0.7 },

    // Vegetables
    { id: 'broccoli', name: 'Broccoli', category: 'Vegetables', serving: '1 cup (91 g)', calories: 31, protein: 2.5, carbs: 6, fat: 0.3, fiber: 2.4, sugar: 1.5 },
    { id: 'carrot', name: 'Carrot', category: 'Vegetables', serving: '1 medium (61 g)', calories: 25, protein: 0.6, carbs: 6, fat: 0.1, fiber: 1.7, sugar: 2.9 },
    { id: 'spinach', name: 'Spinach', category: 'Vegetables', serving: '1 cup raw (30 g)', calories: 7, protein: 0.9, carbs: 1.1, fat: 0.1, fiber: 0.7, sugar: 0.1 },
    { id: 'cucumber', name: 'Cucumber', category: 'Vegetables', serving: '1 cup sliced (104 g)', calories: 16, protein: 0.7, carbs: 3.8, fat: 0.1, fiber: 0.5, sugar: 1.7 },
    { id: 'garden-salad', name: 'Garden Salad', category: 'Vegetables', serving: '1 bowl (150 g)', calories: 90, protein: 2.5, carbs: 9, fat: 5.5, fiber: 3.2, sugar: 4.5 },
    { id: 'sweet-potato', name: 'Sweet Potato (baked)', category: 'Vegetables', serving: '1 medium (130 g)', calories: 112, protein: 2, carbs: 26, fat: 0.1, fiber: 3.9, sugar: 5.4 },

    // Proteins
    { id: 'chicken-breast', name: 'Grilled Chicken Breast', category: 'Proteins', serving: '100 g', calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0 },
    { id: 'egg', name: 'Boiled Egg', category: 'Proteins', serving: '1 large (50 g)', calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, fiber: 0, sugar: 0.6 },
    { id: 'salmon', name: 'Salmon Fillet', category: 'Proteins', serving: '100 g', calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0 },
    { id: 'grilled-fish', name: 'Grilled Fish', category: 'Proteins', serving: '1 fillet (150 g)', calories: 177, protein: 37.5, carbs: 0, fat: 2, fiber: 0, sugar: 0 },
    { id: 'tuna', name: 'Tuna (in water)', category: 'Proteins', serving: '100 g', calories: 116, protein: 26, carbs: 0, fat: 0.8, fiber: 0, sugar: 0 },
    { id: 'beef', name: 'Lean Beef', category: 'Proteins', serving: '100 g', calories: 250, protein: 26, carbs: 0, fat: 15, fiber: 0, sugar: 0 },
    { id: 'lentils', name: 'Lentils (cooked)', category: 'Proteins', serving: '1 cup (198 g)', calories: 230, protein: 18, carbs: 40, fat: 0.8, fiber: 15.6, sugar: 3.6 },

    // Grains
    { id: 'white-rice', name: 'White Rice (cooked)', category: 'Grains', serving: '1 cup (158 g)', calories: 205, protein: 4.3, carbs: 45, fat: 0.4, fiber: 0.6, sugar: 0.1 },
    { id: 'brown-rice', name: 'Brown Rice (cooked)', category: 'Grains', serving: '1 cup (195 g)', calories: 216, protein: 5, carbs: 45, fat: 1.8, fiber: 3.5, sugar: 0.7 },
    { id: 'oats', name: 'Rolled Oats', category: 'Grains', serving: '½ cup dry (40 g)', calories: 150, protein: 5, carbs: 27, fat: 2.5, fiber: 4, sugar: 1 },
    { id: 'wheat-bread', name: 'Whole Wheat Bread', category: 'Grains', serving: '1 slice (32 g)', calories: 81, protein: 4, carbs: 13.8, fat: 1.1, fiber: 1.9, sugar: 1.4 },
    { id: 'arabic-bread', name: 'Arabic Bread (Pita)', category: 'Grains', serving: '1 medium (60 g)', calories: 165, protein: 5.5, carbs: 33, fat: 0.7, fiber: 1.3, sugar: 0.8 },
    { id: 'pasta', name: 'Pasta (cooked)', category: 'Grains', serving: '1 cup (140 g)', calories: 221, protein: 8.1, carbs: 43, fat: 1.3, fiber: 2.5, sugar: 0.8 },

    // Dairy
    { id: 'greek-yogurt', name: 'Greek Yogurt (plain, non-fat)', category: 'Dairy', serving: '1 cup (170 g)', calories: 100, protein: 17, carbs: 6, fat: 0.7, fiber: 0, sugar: 6 },
    { id: 'milk', name: 'Low-Fat Milk', category: 'Dairy', serving: '1 cup (244 ml)', calories: 102, protein: 8.2, carbs: 12.2, fat: 2.4, fiber: 0, sugar: 12.7 },
    { id: 'labneh', name: 'Labneh', category: 'Dairy', serving: '2 tbsp (30 g)', calories: 54, protein: 2.4, carbs: 1.3, fat: 4.5, fiber: 0, sugar: 1 },
    { id: 'cheddar', name: 'Cheddar Cheese', category: 'Dairy', serving: '1 slice (28 g)', calories: 113, protein: 7, carbs: 0.4, fat: 9.3, fiber: 0, sugar: 0.1 },

    // Snacks
    { id: 'almonds', name: 'Almonds', category: 'Snacks', serving: '1 handful (28 g)', calories: 164, protein: 6, carbs: 6.1, fat: 14.2, fiber: 3.5, sugar: 1.2 },
    { id: 'hummus', name: 'Hummus', category: 'Snacks', serving: '¼ cup (60 g)', calories: 100, protein: 4.7, carbs: 8.6, fat: 5.8, fiber: 3.6, sugar: 0.2 },
    { id: 'protein-bar', name: 'Protein Bar', category: 'Snacks', serving: '1 bar (60 g)', calories: 210, protein: 20, carbs: 22, fat: 7, fiber: 3, sugar: 4 },
    { id: 'dark-chocolate', name: 'Dark Chocolate (70–85%)', category: 'Snacks', serving: '28 g', calories: 170, protein: 2.2, carbs: 13, fat: 12, fiber: 3.1, sugar: 6.8 },
    { id: 'popcorn', name: 'Popcorn (air-popped)', category: 'Snacks', serving: '3 cups (24 g)', calories: 93, protein: 3, carbs: 18.6, fat: 1.1, fiber: 3.6, sugar: 0.2 },

    // Drinks
    { id: 'black-coffee', name: 'Black Coffee', category: 'Drinks', serving: '1 cup (240 ml)', calories: 2, protein: 0.3, carbs: 0, fat: 0, fiber: 0, sugar: 0 },
    { id: 'orange-juice', name: 'Orange Juice', category: 'Drinks', serving: '1 cup (248 ml)', calories: 112, protein: 1.7, carbs: 26, fat: 0.5, fiber: 0.5, sugar: 21 },
    { id: 'karak', name: 'Karak Tea', category: 'Drinks', serving: '1 cup (200 ml)', calories: 120, protein: 3, carbs: 18, fat: 4, fiber: 0, sugar: 16 },
    { id: 'cola', name: 'Cola', category: 'Drinks', serving: '1 can (330 ml)', calories: 139, protein: 0, carbs: 35, fat: 0, fiber: 0, sugar: 35 },

    // Meals
    { id: 'shawarma', name: 'Chicken Shawarma Wrap', category: 'Meals', serving: '1 wrap (250 g)', calories: 450, protein: 28, carbs: 42, fat: 18, fiber: 3, sugar: 4 },
    { id: 'falafel', name: 'Falafel', category: 'Meals', serving: '4 pieces (68 g)', calories: 226, protein: 9, carbs: 21, fat: 12, fiber: 5, sugar: 1 },
    { id: 'machboos', name: 'Chicken Machboos', category: 'Meals', serving: '1 plate (350 g)', calories: 520, protein: 32, carbs: 60, fat: 16, fiber: 2, sugar: 4 },
    { id: 'chicken-salad', name: 'Grilled Chicken Salad', category: 'Meals', serving: '1 bowl (300 g)', calories: 350, protein: 35, carbs: 15, fat: 16, fiber: 5, sugar: 6 },
    { id: 'pizza', name: 'Margherita Pizza', category: 'Meals', serving: '1 slice (107 g)', calories: 250, protein: 11, carbs: 31, fat: 9, fiber: 2, sugar: 3.6 }
  ]);

  /* ==========================================================================
     3. UTILITIES
     ========================================================================== */

  /** Date helpers. Dates are stored as local "YYYY-MM-DD" keys. */
  const DateUtil = {
    toKey(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    },
    fromKey(key) {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    todayKey() {
      return DateUtil.toKey(new Date());
    },
    addDays(date, n) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      d.setDate(d.getDate() + n);
      return d;
    },
    /** Monday of the week containing `date` (ISO week). */
    startOfWeek(date) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const offsetFromMonday = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - offsetFromMonday);
      return d;
    },
    /** The 7 dates (Mon–Sun) of the week `weekOffset` weeks from now. */
    weekDates(weekOffset = 0, reference = new Date()) {
      const start = DateUtil.addDays(DateUtil.startOfWeek(reference), weekOffset * 7);
      return Array.from({ length: 7 }, (_, i) => DateUtil.addDays(start, i));
    },
    format(date, options) {
      return date.toLocaleDateString('en-GB', options);
    }
  };

  /** Input validation rules (shared by UI and tests). */
  const Validator = {
    isEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value || '').trim());
    },
    isValidGoal(value) {
      return Number.isInteger(value) && value >= CONFIG.MIN_GOAL && value <= CONFIG.MAX_GOAL;
    },
    isValidServings(value) {
      return typeof value === 'number' && isFinite(value) && value > 0 && value <= CONFIG.MAX_SERVINGS;
    },
    isValidName(value) {
      const v = String(value || '').trim();
      return v.length >= 2 && v.length <= 50;
    }
  };

  /** Display formatting helpers. */
  const Format = {
    kcal: (n) => Math.round(n).toLocaleString('en-US'),
    grams: (n) => `${Math.round(n * 10) / 10}g`,
    servings: (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1)),
    initials(name) {
      return String(name || '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('');
    }
  };

  /** Escape user-provided text before injecting into HTML (XSS safety). */
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Short unique id for records. */
  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  /* ==========================================================================
     4. DATA LAYER
     ========================================================================== */

  /**
   * Storage — thin JSON wrapper over localStorage.
   * Falls back to in-memory storage if localStorage is unavailable
   * (e.g. some private-browsing modes) so the demo never crashes.
   */
  const Storage = (() => {
    const memory = {};
    let persistent = true;
    try {
      const probe = '__ects_probe__';
      localStorage.setItem(probe, probe);
      localStorage.removeItem(probe);
    } catch (e) {
      persistent = false;
    }
    const fullKey = (key) => CONFIG.STORAGE_PREFIX + key;

    return {
      get(key, fallback) {
        try {
          const raw = persistent ? localStorage.getItem(fullKey(key)) : memory[key];
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) {
          return fallback;
        }
      },
      set(key, value) {
        const raw = JSON.stringify(value);
        if (persistent) {
          try {
            localStorage.setItem(fullKey(key), raw);
            return;
          } catch (e) { /* quota exceeded → fall through to memory */ }
        }
        memory[key] = raw;
      },
      remove(key) {
        if (persistent) localStorage.removeItem(fullKey(key));
        delete memory[key];
      },
      /** Remove every key that belongs to this app (used by "Reset demo data"). */
      clearAll() {
        if (persistent) {
          Object.keys(localStorage)
            .filter((k) => k.startsWith(CONFIG.STORAGE_PREFIX))
            .forEach((k) => localStorage.removeItem(k));
        }
        Object.keys(memory).forEach((k) => delete memory[k]);
      },
      isPersistent: () => persistent
    };
  })();

  /**
   * UserRepository — CRUD for user accounts.
   * NOTE: passwords are stored in plain text because this is a client-only
   * prototype. A production system would hash passwords server-side.
   */
  const UserRepository = {
    all() {
      return Storage.get('users', []);
    },
    findById(id) {
      return this.all().find((u) => u.id === id) || null;
    },
    findByEmail(email) {
      const e = String(email || '').trim().toLowerCase();
      return this.all().find((u) => u.email === e) || null;
    },
    save(user) {
      const users = this.all();
      const i = users.findIndex((u) => u.id === user.id);
      if (i >= 0) users[i] = user;
      else users.push(user);
      Storage.set('users', users);
      return user;
    }
  };

  /** MealRepository — persistence for logged meal entries. */
  const MealRepository = {
    all() {
      return Storage.get('meals', []);
    },
    forUser(userId) {
      return this.all().filter((m) => m.userId === userId);
    },
    forDate(userId, dateKey) {
      return this.forUser(userId)
        .filter((m) => m.date === dateKey)
        .sort((a, b) => a.createdAt - b.createdAt);
    },
    add(entry) {
      const meals = this.all();
      meals.push(entry);
      Storage.set('meals', meals);
      return entry;
    },
    remove(id) {
      Storage.set('meals', this.all().filter((m) => m.id !== id));
    }
  };

  /* ==========================================================================
     5. SERVICE LAYER
     ========================================================================== */

  /** Auth — simulated authentication and session management. */
  const Auth = {
    login(email, password) {
      if (!String(email || '').trim() || !password) {
        return { ok: false, error: 'Please enter your email and password.' };
      }
      if (!Validator.isEmail(email)) {
        return { ok: false, error: 'Please enter a valid email address.', field: 'email' };
      }
      const user = UserRepository.findByEmail(email);
      if (!user || user.password !== password) {
        return { ok: false, error: 'Incorrect email or password.' };
      }
      Storage.set('session', { userId: user.id, loggedInAt: Date.now() });
      return { ok: true, user };
    },
    logout() {
      Storage.remove('session');
    },
    currentUser() {
      const session = Storage.get('session', null);
      return session ? UserRepository.findById(session.userId) : null;
    },
    /** Simulated password reset: validates input; no email is actually sent. */
    requestPasswordReset(email) {
      if (!Validator.isEmail(email)) {
        return { ok: false, error: 'Please enter a valid email address.' };
      }
      return { ok: true };
    }
  };

  /** FoodService — lookup and search over the food database. */
  const FoodService = {
    getById(id) {
      return FOOD_DATABASE.find((f) => f.id === id) || null;
    },
    categories() {
      return ['All', ...new Set(FOOD_DATABASE.map((f) => f.category))];
    },
    /**
     * Case-insensitive search by name or category, optionally filtered
     * by category. Foods whose name starts with the query rank first.
     */
    search(query = '', category = 'All') {
      const q = String(query).trim().toLowerCase();
      return FOOD_DATABASE
        .filter((f) => category === 'All' || f.category === category)
        .filter((f) => !q || f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q))
        .sort((a, b) => {
          const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
          const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
          return aStarts - bStarts || a.name.localeCompare(b.name);
        });
    }
  };

  /** Nutrition — pure calculation functions. */
  const Nutrition = {
    round1: (n) => Math.round(n * 10) / 10,

    /** Nutrition values for `servings` of a food. */
    scale(food, servings) {
      return {
        calories: Math.round(food.calories * servings),
        protein: Nutrition.round1(food.protein * servings),
        carbs: Nutrition.round1(food.carbs * servings),
        fat: Nutrition.round1(food.fat * servings),
        fiber: Nutrition.round1((food.fiber || 0) * servings),
        sugar: Nutrition.round1((food.sugar || 0) * servings)
      };
    },

    /** Sum calories and macros over a list of meal entries. */
    totals(entries) {
      const t = entries.reduce(
        (acc, e) => ({
          calories: acc.calories + e.calories,
          protein: acc.protein + e.protein,
          carbs: acc.carbs + e.carbs,
          fat: acc.fat + e.fat
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      return {
        calories: Math.round(t.calories),
        protein: Nutrition.round1(t.protein),
        carbs: Nutrition.round1(t.carbs),
        fat: Nutrition.round1(t.fat)
      };
    },

    /** Daily gram targets derived from the calorie goal and default split. */
    macroTargets(goal) {
      const { MACRO_SPLIT: s, KCAL_PER_GRAM: k } = CONFIG;
      return {
        protein: Math.round((goal * s.protein) / k.protein),
        carbs: Math.round((goal * s.carbs) / k.carbs),
        fat: Math.round((goal * s.fat) / k.fat)
      };
    },

    /** Percentage of target reached (uncapped, integer). */
    percent(value, target) {
      return target > 0 ? Math.round((value / target) * 100) : 0;
    },

    /** Remaining calories; negative means the goal was exceeded. */
    remaining(goal, consumed) {
      return goal - consumed;
    },

    /** Share of calories from each macro (percentages sum to 100). */
    macroSplit(totals) {
      const k = CONFIG.KCAL_PER_GRAM;
      const p = totals.protein * k.protein;
      const c = totals.carbs * k.carbs;
      const f = totals.fat * k.fat;
      const sum = p + c + f;
      if (sum === 0) return { protein: 0, carbs: 0, fat: 0 };
      const protein = Math.round((p / sum) * 100);
      const carbs = Math.round((c / sum) * 100);
      return { protein, carbs, fat: 100 - protein - carbs };
    },

    /** Classify a day: none | under (<90%) | on-target (90–105%) | over. */
    dayStatus(consumed, goal) {
      if (consumed <= 0) return 'none';
      const ratio = consumed / goal;
      if (ratio < 0.9) return 'under';
      if (ratio <= 1.05) return 'on-target';
      return 'over';
    }
  };

  /** MealService — business logic for logging meals. */
  const MealService = {
    /**
     * Log `servings` of a food for a user on a date.
     * Returns { ok, entry } or { ok:false, error }.
     */
    addMeal({ userId, foodId, servings, mealType, date = DateUtil.todayKey(), source = 'search' }) {
      const food = FoodService.getById(foodId);
      if (!food) return { ok: false, error: 'Food not found.' };
      if (!Validator.isValidServings(servings)) return { ok: false, error: 'Servings must be between 0.5 and 10.' };
      if (!CONFIG.MEAL_TYPES.includes(mealType)) return { ok: false, error: 'Please choose a meal type.' };

      const entry = {
        id: uid('meal'),
        userId,
        date,
        mealType,
        foodId: food.id,
        name: food.name,
        serving: food.serving,
        servings,
        source, // how the meal was logged: 'search' | 'scan'
        ...Nutrition.scale(food, servings),
        createdAt: Date.now()
      };
      MealRepository.add(entry);
      return { ok: true, entry };
    },
    removeMeal(id) {
      MealRepository.remove(id);
    },
    /** Totals for one day. */
    dayTotals(userId, dateKey) {
      return Nutrition.totals(MealRepository.forDate(userId, dateKey));
    },
    /** Per-day summaries for a list of Date objects. */
    daySummaries(userId, dates, goal) {
      const all = MealRepository.forUser(userId);
      return dates.map((date) => {
        const key = DateUtil.toKey(date);
        const meals = all.filter((m) => m.date === key).sort((a, b) => a.createdAt - b.createdAt);
        const totals = Nutrition.totals(meals);
        return { date, key, meals, totals, status: Nutrition.dayStatus(totals.calories, goal) };
      });
    },
    /** Suggest a meal type from the current time of day. */
    suggestMealType(now = new Date()) {
      const h = now.getHours();
      if (h < 11) return 'Breakfast';
      if (h < 16) return 'Lunch';
      if (h < 21) return 'Dinner';
      return 'Snack';
    }
  };

  /* ==========================================================================
     5b. SCAN FOOD — SIMULATED FOOD RECOGNITION
     No AI model or external API is used. The "recognizer" is deterministic:
       1. A built-in sample plate maps directly to its known contents.
       2. Otherwise, food keywords in the uploaded file name are detected
          (e.g. "chicken_rice.jpg" → Chicken Breast + White Rice).
       3. Otherwise, the image's average colour picks the closest demo plate
          (yellow → banana, red → apple, green → salad, …).
     Results always reference FOOD_DATABASE, so they log like any other meal.
     ========================================================================== */

  /** File-name keywords → [foodId, estimated servings]. */
  const SCAN_KEYWORDS = Object.freeze({
    chicken: ['chicken-breast', 1.5],
    rice: ['white-rice', 1],
    salad: ['garden-salad', 1],
    apple: ['apple', 1],
    banana: ['banana', 1],
    fish: ['grilled-fish', 1],
    hammour: ['grilled-fish', 1],
    salmon: ['grilled-fish', 1],
    pasta: ['pasta', 1.5],
    spaghetti: ['pasta', 1.5],
    penne: ['pasta', 1.5]
  });

  /** Demo plates the recognizer can return (also used as sample images). */
  const SCAN_DATASET = Object.freeze({
    'chicken-rice-plate': { label: 'Chicken & Rice Plate', items: [['chicken-breast', 1.5], ['white-rice', 1], ['garden-salad', 0.5]] },
    'grilled-fish-plate': { label: 'Grilled Fish Plate', items: [['grilled-fish', 1], ['white-rice', 0.5], ['garden-salad', 1]] },
    'pasta-bowl': { label: 'Pasta Bowl', items: [['pasta', 1.5]] },
    'salad-bowl': { label: 'Salad Bowl', items: [['garden-salad', 1.5]] },
    apple: { label: 'Apple', items: [['apple', 1]] },
    banana: { label: 'Banana', items: [['banana', 1]] }
  });

  /** Small deterministic string hash (djb2) for stable "confidence" values. */
  function hashString(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return h;
  }

  const FoodRecognizer = {
    /** Foods whose keyword appears in the file name (deduplicated). */
    fromFileName(fileName = '') {
      const name = String(fileName).toLowerCase();
      const found = [];
      Object.entries(SCAN_KEYWORDS).forEach(([keyword, [foodId, servings]]) => {
        if (name.includes(keyword) && !found.some((f) => f.foodId === foodId)) {
          found.push({ foodId, servings });
        }
      });
      return found;
    },

    /** Map an average RGB colour to the closest demo plate. */
    classifyColor({ r, g, b }) {
      const brightness = (r + g + b) / 3;
      if (r > 150 && g > 130 && b < 110 && Math.abs(r - g) < 60) return 'banana';     // yellow
      if (r > 140 && r > g * 1.4 && r > b * 1.4) return 'apple';                       // red
      if (g > r && g > b) return 'salad-bowl';                                         // green
      if (r > g && g > b && brightness >= 150) return 'grilled-fish-plate';            // light orange
      if (r > g && g > b && brightness < 150) return 'pasta-bowl';                     // brown / tomato sauce
      return 'chicken-rice-plate';                                                     // neutral / mixed
    },

    /**
     * Simulate recognising the foods in an image.
     * @param {{sampleId?:string, fileName?:string, avgColor?:{r,g,b}}} input
     * @returns {{label:string, method:string, items:Array}}
     */
    analyze({ sampleId = null, fileName = '', avgColor = null } = {}) {
      let method;
      let key = null;
      let items = null;

      if (sampleId && SCAN_DATASET[sampleId]) {
        method = 'sample';
        key = sampleId;
      } else {
        const fromName = FoodRecognizer.fromFileName(fileName);
        if (fromName.length) {
          method = 'filename';
          items = fromName;
        } else if (avgColor) {
          method = 'color';
          key = FoodRecognizer.classifyColor(avgColor);
        } else {
          method = 'default';
          key = 'chicken-rice-plate';
        }
      }

      if (!items) items = SCAN_DATASET[key].items.map(([foodId, servings]) => ({ foodId, servings }));
      const seed = sampleId || fileName || key;

      const detected = items.map((it) => {
        const food = FoodService.getById(it.foodId);
        return {
          foodId: it.foodId,
          name: food.name,
          serving: food.serving,
          servings: it.servings,
          confidence: 84 + (hashString(seed + it.foodId) % 14), // 84–97 %
          included: true
        };
      });

      return {
        label: key ? SCAN_DATASET[key].label : detected.map((d) => d.name).join(' & '),
        method,
        items: detected
      };
    },

    /** Combined nutrition for the items the user kept. */
    totals(items) {
      return Nutrition.totals(
        items.filter((i) => i.included).map((i) => Nutrition.scale(FoodService.getById(i.foodId), i.servings))
      );
    }
  };

  /* ==========================================================================
     6. DEMO SEED
     Creates the demo account and 13 days of history plus today's breakfast
     so that the dashboard and history screens have data on first launch.
     ========================================================================== */
  const DAY_TEMPLATES = [
    [['Breakfast', 'oats', 1], ['Breakfast', 'banana', 1], ['Breakfast', 'milk', 1], ['Lunch', 'machboos', 1], ['Snack', 'almonds', 1], ['Dinner', 'chicken-salad', 1], ['Dinner', 'arabic-bread', 1], ['Snack', 'karak', 1], ['Snack', 'dates', 1], ['Snack', 'orange', 1]],
    [['Breakfast', 'egg', 2], ['Breakfast', 'arabic-bread', 1], ['Breakfast', 'labneh', 1], ['Lunch', 'shawarma', 1], ['Snack', 'apple', 1], ['Dinner', 'salmon', 1.5], ['Dinner', 'brown-rice', 1], ['Snack', 'greek-yogurt', 1], ['Lunch', 'hummus', 1], ['Snack', 'almonds', 1], ['Snack', 'dates', 1]],
    [['Breakfast', 'greek-yogurt', 1], ['Breakfast', 'strawberries', 1], ['Breakfast', 'oats', 1], ['Lunch', 'chicken-breast', 1.5], ['Lunch', 'white-rice', 1], ['Snack', 'protein-bar', 1], ['Dinner', 'pasta', 1.5], ['Snack', 'banana', 1], ['Lunch', 'avocado', 1], ['Snack', 'almonds', 1], ['Dinner', 'chicken-breast', 1]],
    [['Breakfast', 'labneh', 2], ['Breakfast', 'arabic-bread', 1], ['Lunch', 'falafel', 1], ['Lunch', 'hummus', 1], ['Lunch', 'arabic-bread', 1], ['Snack', 'dates', 1], ['Dinner', 'pizza', 3], ['Snack', 'cola', 1], ['Snack', 'dark-chocolate', 1], ['Snack', 'karak', 1], ['Breakfast', 'egg', 2]],
    [['Breakfast', 'oats', 1], ['Breakfast', 'milk', 1], ['Lunch', 'tuna', 1], ['Lunch', 'sweet-potato', 1], ['Dinner', 'beef', 1], ['Dinner', 'broccoli', 1], ['Dinner', 'white-rice', 1], ['Snack', 'dark-chocolate', 1], ['Lunch', 'brown-rice', 1], ['Snack', 'protein-bar', 1], ['Breakfast', 'banana', 1], ['Snack', 'greek-yogurt', 1], ['Breakfast', 'egg', 2]],
    [['Breakfast', 'egg', 2], ['Breakfast', 'avocado', 1], ['Breakfast', 'wheat-bread', 2], ['Lunch', 'lentils', 1], ['Lunch', 'arabic-bread', 1], ['Dinner', 'machboos', 1], ['Snack', 'orange', 1], ['Snack', 'almonds', 1]],
    [['Breakfast', 'greek-yogurt', 1], ['Breakfast', 'banana', 1], ['Lunch', 'chicken-salad', 1], ['Snack', 'popcorn', 1], ['Dinner', 'shawarma', 1], ['Snack', 'karak', 1], ['Breakfast', 'oats', 1], ['Lunch', 'white-rice', 1], ['Snack', 'dates', 1], ['Dinner', 'hummus', 1]]
  ];

  function seedDemoData() {
    if (Storage.get('seeded', false)) return;

    const demoUser = {
      id: 'user_demo',
      name: 'Demo User',
      email: CONFIG.DEMO_ACCOUNT.email,
      password: CONFIG.DEMO_ACCOUNT.password,
      dailyGoal: CONFIG.DEFAULT_GOAL,
      userType: 'Standard User',
      createdAt: Date.now()
    };
    UserRepository.save(demoUser);

    const today = new Date();
    const seedDay = (dayOffset, template, onlyType) => {
      const date = DateUtil.toKey(DateUtil.addDays(today, dayOffset));
      template
        .filter(([type]) => !onlyType || type === onlyType)
        .forEach(([mealType, foodId, servings]) => {
          MealService.addMeal({ userId: demoUser.id, foodId, servings, mealType, date });
        });
    };

    for (let offset = -13; offset <= -1; offset++) {
      // Use the absolute day number so the same date always gets the same template
      const dayNumber = Math.floor(DateUtil.addDays(today, offset).getTime() / 86400000);
      seedDay(offset, DAY_TEMPLATES[((dayNumber % 7) + 7) % 7]);
    }
    seedDay(0, DAY_TEMPLATES[0], 'Breakfast');

    Storage.set('seeded', true);
  }

  /* ==========================================================================
     7. UI LAYER
     ========================================================================== */

  const $ = (selector, root = document) => root.querySelector(selector);

  /** Transient UI state (not persisted). */
  const UIState = {
    searchQuery: '',
    searchCategory: 'All',
    historyWeekOffset: 0,
    food: { id: null, servings: 1, mealType: 'Breakfast' },
    // Scan Food screen: image source, analysis status and detected items
    scan: { imageUrl: null, fileName: '', sampleId: null, avgColor: null, status: 'idle', result: null, mealType: null, token: 0 }
  };

  const MACRO_COLORS = {
    protein: 'var(--macro-protein)',
    carbs: 'var(--macro-carbs)',
    fat: 'var(--macro-fat)'
  };

  /* ---- Shared UI helpers ------------------------------------------------- */

  let toastTimer = null;
  function showToast(message, type = 'success') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.className = `toast${type === 'error' ? ' toast--error' : ''}${Auth.currentUser() ? '' : ' toast--login'}`;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  /** SVG circular progress ring. */
  function ringSvg({ size = 140, stroke = 14, percent = 0, color = 'var(--color-accent)' }) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, percent));
    const offset = c * (1 - pct / 100);
    return `
      <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${Math.round(percent)}% of goal">
        <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>
        <circle class="ring__value" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
          stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${offset}"
          transform="rotate(-90 ${size / 2} ${size / 2})"/>
      </svg>`;
  }

  /** SVG donut made of coloured segments (macro split). */
  function donutSvg(segments, { size = 130, stroke = 22, centerText = '' } = {}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const mid = size / 2;
    let acc = 0;
    const arcs = segments
      .filter((s) => s.percent > 0)
      .map((s) => {
        const len = (c * s.percent) / 100;
        const arc = `<circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${stroke}"
          stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${mid} ${mid})"/>`;
        acc += len;
        return arc;
      })
      .join('');
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Macronutrient split">
        <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="var(--color-track)" stroke-width="${stroke}"/>
        ${arcs}
        <text x="${mid}" y="${mid + 4}" text-anchor="middle" class="macro-donut-center">${escapeHtml(centerText)}</text>
      </svg>`;
  }

  /** Labelled horizontal progress bar. */
  function progressRow(label, value, target, unit, color) {
    const pct = Nutrition.percent(value, target);
    const over = pct > 100;
    return `
      <div class="progress-row">
        <div class="progress-row__label">
          <span>${escapeHtml(label)}</span>
          <span>${Math.round(value)} / ${target}${unit}</span>
        </div>
        <div class="progress progress--thin${over ? ' progress--over' : ''}" role="progressbar"
             aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(label)}">
          <div class="progress__bar" style="width:${Math.min(pct, 100)}%;${over ? '' : `background:${color}`}"></div>
        </div>
      </div>`;
  }

  /** Mini stacked bar + values used in search results. */
  function nutritionPreview(food) {
    const split = Nutrition.macroSplit(food);
    return `
      <div class="nutri-preview">
        <div class="nutri-preview__bar" aria-hidden="true">
          <span style="width:${split.protein}%;background:${MACRO_COLORS.protein}"></span>
          <span style="width:${split.carbs}%;background:${MACRO_COLORS.carbs}"></span>
          <span style="width:${split.fat}%;background:${MACRO_COLORS.fat}"></span>
        </div>
        <div class="nutri-preview__values">
          <span><i class="dot" style="background:${MACRO_COLORS.protein}"></i>P ${Format.grams(food.protein)}</span>
          <span><i class="dot" style="background:${MACRO_COLORS.carbs}"></i>C ${Format.grams(food.carbs)}</span>
          <span><i class="dot" style="background:${MACRO_COLORS.fat}"></i>F ${Format.grams(food.fat)}</span>
        </div>
      </div>`;
  }

  /** List of meal entries grouped by meal type. */
  function mealGroupsHtml(meals, { removable = false } = {}) {
    return CONFIG.MEAL_TYPES
      .map((type) => {
        const items = meals.filter((m) => m.mealType === type);
        if (!items.length) return '';
        const total = items.reduce((s, m) => s + m.calories, 0);
        return `
          <div class="meal-group">
            <div class="meal-group__title"><span>${type}</span><span>${Format.kcal(total)} kcal</span></div>
            ${items.map((m) => `
              <div class="meal-item">
                <div class="meal-item__info">
                  <div class="meal-item__name">${escapeHtml(m.name)}${m.source === 'scan' ? '<span class="tag-scan">Scanned</span>' : ''}</div>
                  <div class="meal-item__sub">${Format.servings(m.servings)} × ${escapeHtml(m.serving)} · P ${Format.grams(m.protein)} · C ${Format.grams(m.carbs)} · F ${Format.grams(m.fat)}</div>
                </div>
                <div class="meal-item__kcal">${Format.kcal(m.calories)} kcal</div>
                ${removable ? `
                  <button class="meal-item__remove" data-action="remove-meal" data-id="${m.id}" aria-label="Remove ${escapeHtml(m.name)}">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  </button>` : ''}
              </div>`).join('')}
          </div>`;
      })
      .join('');
  }

  const STATUS_LABEL = { none: 'No data', under: 'Under goal', 'on-target': 'On target', over: 'Over goal' };

  /* ---- Screen: Login ------------------------------------------------------ */
  const LoginView = {
    render() {
      $('#login-error').hidden = true;
      $('#login-email').classList.remove('is-invalid');
    },
    bind() {
      $('#login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = $('#login-email').value;
        const password = $('#login-password').value;
        const result = Auth.login(email, password);
        const errorEl = $('#login-error');

        if (!result.ok) {
          errorEl.textContent = result.error;
          errorEl.hidden = false;
          $('#login-email').classList.toggle('is-invalid', result.field === 'email');
          return;
        }
        $('#login-form').reset();
        showToast(`Welcome, ${result.user.name.split(' ')[0]}!`);
        Router.go('dashboard');
      });

      $('#screen-login').addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'toggle-password') {
          const input = $('#login-password');
          const show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          e.target.textContent = show ? 'Hide' : 'Show';
          e.target.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        } else if (action === 'fill-demo') {
          $('#login-email').value = CONFIG.DEMO_ACCOUNT.email;
          $('#login-password').value = CONFIG.DEMO_ACCOUNT.password;
        } else if (action === 'open-forgot') {
          ForgotModal.open();
        }
      });
    }
  };

  /* ---- Modal: Forgot password -------------------------------------------- */
  const ForgotModal = {
    open() {
      $('#forgot-email').value = $('#login-email').value;
      $('#forgot-error').hidden = true;
      $('#forgot-success').hidden = true;
      $('#forgot-modal').hidden = false;
      $('#forgot-email').focus();
    },
    close() {
      $('#forgot-modal').hidden = true;
    },
    bind() {
      $('#forgot-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = $('#forgot-email').value.trim();
        const result = Auth.requestPasswordReset(email);
        $('#forgot-error').hidden = result.ok;
        $('#forgot-success').hidden = !result.ok;
        if (!result.ok) {
          $('#forgot-error').textContent = result.error;
        } else {
          $('#forgot-success').textContent = `If an account exists for ${email}, a reset link has been sent. (Simulated — no email is sent in this prototype.)`;
        }
      });
      $('#forgot-modal').addEventListener('click', (e) => {
        if (e.target.closest('[data-action="close-forgot"]')) ForgotModal.close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !$('#forgot-modal').hidden) ForgotModal.close();
      });
    }
  };

  /* ---- Screen: Dashboard -------------------------------------------------- */
  const DashboardView = {
    render(user) {
      const todayKey = DateUtil.todayKey();
      const meals = MealRepository.forDate(user.id, todayKey);
      const totals = Nutrition.totals(meals);
      const goal = user.dailyGoal;
      const remaining = Nutrition.remaining(goal, totals.calories);
      const pct = Nutrition.percent(totals.calories, goal);
      const targets = Nutrition.macroTargets(goal);
      const split = Nutrition.macroSplit(totals);
      const week = MealService.daySummaries(user.id, DateUtil.weekDates(0), goal);
      const weekTotal = week.reduce((s, d) => s + d.totals.calories, 0);
      const firstName = user.name.split(' ')[0];

      $('#screen-dashboard').innerHTML = `
        <header class="page-header page-header--row">
          <div>
            <p class="greeting__date">${DateUtil.format(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 class="page-title" id="dashboard-title">Hello, ${escapeHtml(firstName)}</h1>
          </div>
          <a href="#/profile" class="avatar" aria-label="Open profile">${escapeHtml(Format.initials(user.name))}</a>
        </header>

        <div class="dashboard-grid">
          <div class="col">
            <!-- Calories consumed / remaining / goal progress -->
            <article class="card" aria-labelledby="cal-title">
              <div class="card__header">
                <h2 class="section-title" id="cal-title">Calories Tracking</h2>
                <span class="card__meta">Today</span>
              </div>
              <div class="cal-summary">
                <div class="ring-wrap">
                  ${ringSvg({ percent: pct, color: pct > 100 ? 'var(--color-danger)' : 'var(--color-accent)' })}
                  <div class="ring-wrap__center">
                    <span class="ring-wrap__value" data-testid="calories-consumed">${Format.kcal(totals.calories)}</span>
                    <span class="ring-wrap__label">kcal eaten</span>
                  </div>
                </div>
                <div class="stat-list">
                  <div class="stat">
                    <span class="stat__label">Daily goal</span>
                    <span class="stat__value" data-testid="calorie-goal">${Format.kcal(goal)} <small>kcal</small></span>
                  </div>
                  <div class="stat">
                    <span class="stat__label">${remaining >= 0 ? 'Remaining' : 'Over goal by'}</span>
                    <span class="stat__value${remaining < 0 ? ' stat__value--over' : ''}" data-testid="calories-remaining">${Format.kcal(Math.abs(remaining))} <small>kcal</small></span>
                  </div>
                </div>
              </div>
              <div class="goal-progress">
                <div class="progress-row__label"><span>Goal progress</span><span data-testid="goal-percent">${pct}%</span></div>
                <div class="progress${pct > 100 ? ' progress--over' : ''}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Daily goal progress">
                  <div class="progress__bar progress__bar--lime" style="width:${Math.min(pct, 100)}%"></div>
                </div>
              </div>
            </article>

            <!-- Macronutrient tracking -->
            <article class="card" aria-labelledby="macro-title">
              <div class="card__header">
                <h2 class="section-title" id="macro-title">Macros Tracking</h2>
                <span class="card__meta">% of calories</span>
              </div>
              <div class="macro-chart">
                ${donutSvg([
                  { percent: split.protein, color: MACRO_COLORS.protein },
                  { percent: split.carbs, color: MACRO_COLORS.carbs },
                  { percent: split.fat, color: MACRO_COLORS.fat }
                ], { centerText: totals.calories ? 'Today' : 'No data' })}
                <div class="macro-legend">
                  <div class="macro-legend__item"><i class="dot" style="background:${MACRO_COLORS.protein}"></i>Protein<b>${split.protein}%</b></div>
                  <div class="macro-legend__item"><i class="dot" style="background:${MACRO_COLORS.carbs}"></i>Carbs<b>${split.carbs}%</b></div>
                  <div class="macro-legend__item"><i class="dot" style="background:${MACRO_COLORS.fat}"></i>Fat<b>${split.fat}%</b></div>
                </div>
              </div>
              ${progressRow('Protein', totals.protein, targets.protein, 'g', MACRO_COLORS.protein)}
              ${progressRow('Carbohydrates', totals.carbs, targets.carbs, 'g', MACRO_COLORS.carbs)}
              ${progressRow('Fat', totals.fat, targets.fat, 'g', MACRO_COLORS.fat)}
            </article>
          </div>

          <div class="col">
            <!-- Weekly overview -->
            <article class="card" aria-labelledby="week-title">
              <div class="card__header">
                <h2 class="section-title" id="week-title">Weekly Overview</h2>
                <span class="card__meta">${Format.kcal(weekTotal)} kcal this week</span>
              </div>
              <div class="week-rows">
                ${week.map((d) => {
                  const isToday = d.key === todayKey;
                  const isFuture = d.key > todayKey;
                  const dayPct = Nutrition.percent(d.totals.calories, goal);
                  return `
                    <div class="week-row${isToday ? ' is-today' : ''}${isFuture ? ' is-future' : ''}">
                      <span class="week-row__day">${DateUtil.format(d.date, { weekday: 'narrow' })}</span>
                      <div class="progress progress--thin${dayPct > 105 ? ' progress--over' : ''}" aria-label="${DateUtil.format(d.date, { weekday: 'long' })}: ${d.totals.calories} kcal">
                        <div class="progress__bar progress__bar--lime" style="width:${Math.min(dayPct, 100)}%"></div>
                      </div>
                      <span class="week-row__value">${d.totals.calories ? Format.kcal(d.totals.calories) : '—'}</span>
                    </div>`;
                }).join('')}
              </div>
            </article>

            <!-- Today's meals -->
            <article class="card" aria-labelledby="meals-title">
              <div class="card__header">
                <h2 class="section-title" id="meals-title">Today's Meals</h2>
                <span class="card__meta">${meals.length} item${meals.length === 1 ? '' : 's'}</span>
              </div>
              ${meals.length
                ? mealGroupsHtml(meals, { removable: true })
                : `<div class="empty"><div class="empty__icon" aria-hidden="true">🍽️</div><p>No meals logged yet today.</p>
                   <a href="#/search" class="btn btn--primary">Add your first meal</a></div>`}
            </article>
          </div>
        </div>`;
    },
    bind() {
      $('#screen-dashboard').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="remove-meal"]');
        if (!btn) return;
        MealService.removeMeal(btn.dataset.id);
        showToast('Meal removed');
        Router.refresh();
      });
    }
  };

  /* ---- Screen: Search Food ------------------------------------------------ */
  const SearchView = {
    render() {
      $('#search-input').value = UIState.searchQuery;

      $('#search-categories').innerHTML = FoodService.categories()
        .map((c) => `<button type="button" class="chip${c === UIState.searchCategory ? ' is-active' : ''}" role="tab"
          aria-selected="${c === UIState.searchCategory}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
        .join('');

      SearchView.renderResults();
    },
    renderResults() {
      const results = FoodService.search(UIState.searchQuery, UIState.searchCategory);
      const q = UIState.searchQuery.trim();

      $('#search-meta').textContent = `${results.length} food${results.length === 1 ? '' : 's'} found` +
        (q ? ` for "${q}"` : '') + (UIState.searchCategory !== 'All' ? ` in ${UIState.searchCategory}` : '');

      $('#search-results').innerHTML = results.length
        ? results.map((f) => `
            <li>
              <button type="button" class="food-card" data-food-id="${f.id}" aria-label="View details for ${escapeHtml(f.name)}">
                <div class="food-card__top">
                  <div>
                    <div class="food-card__name">${escapeHtml(f.name)}</div>
                    <div class="food-card__serving">${escapeHtml(f.serving)} · ${escapeHtml(f.category)}</div>
                  </div>
                  <span class="badge">${f.calories} kcal</span>
                </div>
                ${nutritionPreview(f)}
              </button>
            </li>`).join('')
        : `<li class="empty empty--dark"><div class="empty__icon" aria-hidden="true">🔍</div>
             <p>No foods match your search.<br>Try another name or category.</p></li>`;
    },
    bind() {
      // Search button / Enter key
      $('#search-form').addEventListener('submit', (e) => {
        e.preventDefault();
        UIState.searchQuery = $('#search-input').value;
        SearchView.renderResults();
      });
      // Live filtering while typing
      $('#search-input').addEventListener('input', (e) => {
        UIState.searchQuery = e.target.value;
        SearchView.renderResults();
      });
      // Category chips
      $('#search-categories').addEventListener('click', (e) => {
        const chip = e.target.closest('[data-category]');
        if (!chip) return;
        UIState.searchCategory = chip.dataset.category;
        SearchView.render();
      });
      // Open food details
      $('#search-results').addEventListener('click', (e) => {
        const card = e.target.closest('[data-food-id]');
        if (card) Router.go(`food/${card.dataset.foodId}`);
      });
    }
  };

  /* ---- Screen: Food Details ----------------------------------------------- */
  const FoodView = {
    render(user, foodId) {
      const food = FoodService.getById(foodId);
      const root = $('#screen-food');

      if (!food) {
        root.innerHTML = `
          <button class="back-btn" data-action="back">← Back</button>
          <div class="card empty"><div class="empty__icon">🤷</div><p>Food not found.</p>
          <a class="btn btn--primary" href="#/search">Search foods</a></div>`;
        return;
      }

      // Reset selection when opening a different food
      if (UIState.food.id !== foodId) {
        UIState.food = { id: foodId, servings: 1, mealType: MealService.suggestMealType() };
      }
      const { servings, mealType } = UIState.food;
      const n = Nutrition.scale(food, servings);
      const targets = Nutrition.macroTargets(user.dailyGoal);
      const today = MealService.dayTotals(user.id, DateUtil.todayKey());
      const after = today.calories + n.calories;

      root.innerHTML = `
        <button class="back-btn" data-action="back" aria-label="Back to search">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
          Back
        </button>

        <div class="detail-layout">
          <div class="col">
            <article class="card detail-hero">
              <span class="badge badge--soft detail-hero__category">${escapeHtml(food.category)}</span>
              <h1 class="detail-hero__name" data-testid="food-name">${escapeHtml(food.name)}</h1>
              <p class="detail-hero__serving">Serving size: <strong data-testid="serving-size">${escapeHtml(food.serving)}</strong></p>
              <div class="detail-hero__kcal">
                <div class="detail-hero__kcal-value" data-testid="food-calories">${n.calories}</div>
                <div class="detail-hero__kcal-label">calories for ${Format.servings(servings)} serving${servings === 1 ? '' : 's'}</div>
              </div>
            </article>

            <article class="card" aria-labelledby="food-macros-title">
              <h2 class="section-title" id="food-macros-title">Nutrition Facts</h2>
              <div class="macro-grid">
                <div class="macro-tile" style="--tile-color:${MACRO_COLORS.protein}">
                  <div class="macro-tile__value" data-testid="food-protein">${Format.grams(n.protein)}</div>
                  <div class="macro-tile__label">Protein</div>
                </div>
                <div class="macro-tile" style="--tile-color:${MACRO_COLORS.carbs}">
                  <div class="macro-tile__value" data-testid="food-carbs">${Format.grams(n.carbs)}</div>
                  <div class="macro-tile__label">Carbohydrates</div>
                </div>
                <div class="macro-tile" style="--tile-color:${MACRO_COLORS.fat}">
                  <div class="macro-tile__value" data-testid="food-fat">${Format.grams(n.fat)}</div>
                  <div class="macro-tile__label">Fat</div>
                </div>
              </div>
              <div class="extra-nutrients">
                <span>Fiber <b>${Format.grams(n.fiber)}</b></span>
                <span>Sugar <b>${Format.grams(n.sugar)}</b></span>
              </div>
              ${progressRow('Protein of daily target', n.protein, targets.protein, 'g', MACRO_COLORS.protein)}
              ${progressRow('Carbs of daily target', n.carbs, targets.carbs, 'g', MACRO_COLORS.carbs)}
              ${progressRow('Fat of daily target', n.fat, targets.fat, 'g', MACRO_COLORS.fat)}
            </article>
          </div>

          <div class="col">
            <article class="card" aria-labelledby="add-title">
              <h2 class="section-title" id="add-title">Add To Meal</h2>

              <div class="field">
                <span class="field__label" id="servings-label">Servings</span>
                <div class="stepper" role="group" aria-labelledby="servings-label">
                  <button type="button" class="stepper__btn" data-action="servings-dec" aria-label="Decrease servings">−</button>
                  <div class="stepper__value"><strong data-testid="servings">${Format.servings(servings)}</strong><span>× ${escapeHtml(food.serving)}</span></div>
                  <button type="button" class="stepper__btn" data-action="servings-inc" aria-label="Increase servings">+</button>
                </div>
              </div>

              <div class="field">
                <span class="field__label" id="mealtype-label">Meal</span>
                <div class="segmented" role="radiogroup" aria-labelledby="mealtype-label">
                  ${CONFIG.MEAL_TYPES.map((t) => `
                    <button type="button" class="segmented__btn${t === mealType ? ' is-active' : ''}" role="radio"
                      aria-checked="${t === mealType}" data-meal-type="${t}">${t}</button>`).join('')}
                </div>
              </div>

              <p class="field__hint">Today after adding: <strong>${Format.kcal(after)}</strong> / ${Format.kcal(user.dailyGoal)} kcal
                ${after > user.dailyGoal ? ' — <span style="color:var(--color-danger)">over your goal</span>' : ''}</p>

              <div class="sticky-action">
                <button type="button" class="btn btn--primary btn--block btn--lg" data-action="add-meal" data-testid="add-to-meal">
                  Add To Meal · ${n.calories} kcal
                </button>
              </div>
            </article>
          </div>
        </div>`;
    },
    bind() {
      $('#screen-food').addEventListener('click', (e) => {
        const target = e.target.closest('[data-action], [data-meal-type]');
        if (!target) return;
        const user = Auth.currentUser();
        const s = UIState.food;

        if (target.dataset.mealType) {
          s.mealType = target.dataset.mealType;
          return Router.refresh();
        }
        switch (target.dataset.action) {
          case 'back':
            return Router.go('search');
          case 'servings-dec':
            s.servings = Math.max(CONFIG.SERVING_STEP, s.servings - CONFIG.SERVING_STEP);
            return Router.refresh();
          case 'servings-inc':
            s.servings = Math.min(CONFIG.MAX_SERVINGS, s.servings + CONFIG.SERVING_STEP);
            return Router.refresh();
          case 'add-meal': {
            const result = MealService.addMeal({ userId: user.id, foodId: s.id, servings: s.servings, mealType: s.mealType });
            if (!result.ok) return showToast(result.error, 'error');
            showToast(`Added ${result.entry.name} to ${result.entry.mealType} (+${result.entry.calories} kcal)`);
            UIState.food.id = null; // reset selection for next time
            return Router.go('dashboard');
          }
        }
      });
    }
  };

  /* ---- Screen: Nutrition History ----------------------------------------- */
  const HistoryView = {
    render(user) {
      const offset = UIState.historyWeekOffset;
      const goal = user.dailyGoal;
      const dates = DateUtil.weekDates(offset);
      const todayKey = DateUtil.todayKey();
      const days = MealService.daySummaries(user.id, dates, goal);
      const logged = days.filter((d) => d.totals.calories > 0);
      const weekTotals = Nutrition.totals(logged.map((d) => d.totals));
      const avg = (v) => (logged.length ? v / logged.length : 0);
      const avgCalories = Math.round(avg(weekTotals.calories));
      const onTarget = days.filter((d) => d.status === 'on-target').length;
      const split = Nutrition.macroSplit(weekTotals);
      const targets = Nutrition.macroTargets(goal);

      // Chart scale: leave headroom above the goal line
      const maxVal = Math.max(goal * 1.25, ...days.map((d) => d.totals.calories));
      const rangeLabel = `${DateUtil.format(dates[0], { day: 'numeric', month: 'short' })} – ${DateUtil.format(dates[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
      const weekLabel = offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${Math.abs(offset)} weeks ago`;

      $('#screen-history').innerHTML = `
        <header class="page-header">
          <h1 class="page-title" id="history-title">Nutrition History</h1>
          <p class="page-subtitle">Your meals, calories and macros over time</p>
        </header>

        <div class="week-nav">
          <button class="icon-btn" data-action="prev-week" aria-label="Previous week">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
          </button>
          <div class="week-nav__label" data-testid="week-label">${weekLabel}<small>${rangeLabel}</small></div>
          <button class="icon-btn" data-action="next-week" aria-label="Next week" ${offset >= 0 ? 'disabled' : ''}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div class="summary-grid">
          <div class="summary-tile"><div class="summary-tile__value">${Format.kcal(weekTotals.calories)}</div><div class="summary-tile__label">Total kcal</div></div>
          <div class="summary-tile"><div class="summary-tile__value">${Format.kcal(avgCalories)}</div><div class="summary-tile__label">Daily average</div></div>
          <div class="summary-tile"><div class="summary-tile__value">${onTarget}/7</div><div class="summary-tile__label">Days on target</div></div>
        </div>

        <div class="history-layout" style="margin-top:var(--space-4)">
          <div class="col">
            <!-- Daily calorie history chart -->
            <article class="card" aria-labelledby="daily-chart-title">
              <div class="card__header">
                <h2 class="section-title" id="daily-chart-title">Daily Calorie History</h2>
                <span class="card__meta">Goal ${Format.kcal(goal)}</span>
              </div>
              <div class="bar-chart" role="img" aria-label="Calories per day for ${rangeLabel}">
                <div class="bar-chart__goal" style="bottom:${(goal / maxVal) * 100}%"><span>Goal</span></div>
                ${days.map((d) => {
                  const h = (d.totals.calories / maxVal) * 100;
                  const cls = d.totals.calories === 0 ? ' bar-chart__bar--empty' : d.status === 'over' ? ' bar-chart__bar--over' : '';
                  return `<div class="bar-chart__col" title="${DateUtil.format(d.date, { weekday: 'long' })}: ${d.totals.calories} kcal">
                    <div class="bar-chart__bar${cls}" style="height:${Math.max(h, 2)}%"></div></div>`;
                }).join('')}
              </div>
              <div class="bar-chart__labels">
                ${days.map((d) => `<div>${DateUtil.format(d.date, { weekday: 'short' })}<small>${d.totals.calories ? Format.kcal(d.totals.calories) : '—'}</small></div>`).join('')}
              </div>
            </article>

            <!-- Nutrition tracking history -->
            <article class="card" aria-labelledby="nutri-history-title">
              <div class="card__header">
                <h2 class="section-title" id="nutri-history-title">Nutrition Tracking</h2>
                <span class="card__meta">Daily average</span>
              </div>
              ${logged.length ? `
                <div class="macro-chart">
                  ${donutSvg([
                    { percent: split.protein, color: MACRO_COLORS.protein },
                    { percent: split.carbs, color: MACRO_COLORS.carbs },
                    { percent: split.fat, color: MACRO_COLORS.fat }
                  ], { centerText: 'Avg' })}
                  <div class="macro-legend">
                    <div class="macro-legend__item"><i class="dot" style="background:${MACRO_COLORS.protein}"></i>Protein<b>${split.protein}%</b></div>
                    <div class="macro-legend__item"><i class="dot" style="background:${MACRO_COLORS.carbs}"></i>Carbs<b>${split.carbs}%</b></div>
                    <div class="macro-legend__item"><i class="dot" style="background:${MACRO_COLORS.fat}"></i>Fat<b>${split.fat}%</b></div>
                  </div>
                </div>
                ${progressRow('Protein (avg/day)', avg(weekTotals.protein), targets.protein, 'g', MACRO_COLORS.protein)}
                ${progressRow('Carbohydrates (avg/day)', avg(weekTotals.carbs), targets.carbs, 'g', MACRO_COLORS.carbs)}
                ${progressRow('Fat (avg/day)', avg(weekTotals.fat), targets.fat, 'g', MACRO_COLORS.fat)}
              ` : '<div class="empty"><p>No nutrition data for this week.</p></div>'}
            </article>
          </div>

          <div class="col">
            <!-- Weekly meal history (per-day accordion) -->
            <article class="card" aria-labelledby="meal-history-title">
              <div class="card__header">
                <h2 class="section-title" id="meal-history-title">Weekly Meal History</h2>
                <span class="card__meta">${logged.length} day${logged.length === 1 ? '' : 's'} logged</span>
              </div>
              ${days.slice().reverse().filter((d) => d.key <= todayKey).map((d) => `
                <details class="day-entry"${d.key === todayKey ? ' open' : ''}>
                  <summary>
                    <span class="day-entry__date">${DateUtil.format(d.date, { weekday: 'long' })}<small>${DateUtil.format(d.date, { day: 'numeric', month: 'long' })}</small></span>
                    <span class="badge badge--${d.status}">${STATUS_LABEL[d.status]}</span>
                    <span class="day-entry__kcal">${Format.kcal(d.totals.calories)}</span>
                    <svg class="day-entry__chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                  </summary>
                  <div class="day-entry__body">
                    ${d.meals.length ? `
                      <div class="day-entry__macros">
                        <span><i class="dot" style="background:${MACRO_COLORS.protein}"></i> P ${Format.grams(d.totals.protein)}</span>
                        <span><i class="dot" style="background:${MACRO_COLORS.carbs}"></i> C ${Format.grams(d.totals.carbs)}</span>
                        <span><i class="dot" style="background:${MACRO_COLORS.fat}"></i> F ${Format.grams(d.totals.fat)}</span>
                      </div>
                      ${mealGroupsHtml(d.meals)}` : '<p class="muted">No meals logged.</p>'}
                  </div>
                </details>`).join('') || '<div class="empty"><p>This week hasn\'t started yet.</p></div>'}
            </article>
          </div>
        </div>`;
    },
    bind() {
      $('#screen-history').addEventListener('click', (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'prev-week') {
          UIState.historyWeekOffset -= 1;
          Router.refresh();
        } else if (action === 'next-week' && UIState.historyWeekOffset < 0) {
          UIState.historyWeekOffset += 1;
          Router.refresh();
        }
      });
    }
  };

  /* ---- Screen: User Profile ----------------------------------------------- */
  const ProfileView = {
    render(user) {
      const targets = Nutrition.macroTargets(user.dailyGoal);
      $('#screen-profile').innerHTML = `
        <header class="page-header">
          <h1 class="page-title" id="profile-title">Profile</h1>
          <p class="page-subtitle">Manage your account and daily goal</p>
        </header>

        <div class="profile-head">
          <div class="avatar avatar--lg" aria-hidden="true">${escapeHtml(Format.initials(user.name))}</div>
          <div class="profile-head__name">${escapeHtml(user.name)}</div>
          <div class="profile-head__type"><span class="badge">${escapeHtml(user.userType)}</span></div>
        </div>

        <form class="card" id="profile-form" novalidate>
          <h2 class="section-title">Account details</h2>

          <div class="field">
            <label class="field__label" for="profile-name">Name</label>
            <input class="input" id="profile-name" type="text" value="${escapeHtml(user.name)}" autocomplete="name" required>
          </div>

          <div class="field">
            <label class="field__label" for="profile-email">Email</label>
            <input class="input" id="profile-email" type="email" value="${escapeHtml(user.email)}" autocomplete="email" required>
          </div>

          <div class="field">
            <label class="field__label" for="profile-goal">Daily Calorie Goal</label>
            <div class="goal-input">
              <button type="button" class="stepper__btn" data-action="goal-dec" aria-label="Decrease goal by 50">−</button>
              <input class="input" id="profile-goal" type="number" inputmode="numeric" min="${CONFIG.MIN_GOAL}" max="${CONFIG.MAX_GOAL}" step="50" value="${user.dailyGoal}" required>
              <button type="button" class="stepper__btn" data-action="goal-inc" aria-label="Increase goal by 50">+</button>
              <span class="goal-input__unit">kcal</span>
            </div>
            <div class="preset-row">
              ${[1500, 1800, 2000, 2500, 3000].map((g) => `<button type="button" class="chip" data-goal="${g}">${Format.kcal(g)}</button>`).join('')}
            </div>
            <p class="field__hint">Between ${Format.kcal(CONFIG.MIN_GOAL)} and ${Format.kcal(CONFIG.MAX_GOAL)} kcal.</p>
            <div class="macro-targets" id="macro-targets" aria-live="polite">
              <div><b>${targets.protein}g</b>Protein</div>
              <div><b>${targets.carbs}g</b>Carbs</div>
              <div><b>${targets.fat}g</b>Fat</div>
            </div>
          </div>

          <div class="field">
            <label class="field__label" for="profile-type">User Type</label>
            <select class="select" id="profile-type">
              ${CONFIG.USER_TYPES.map((t) => `<option${t === user.userType ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>

          <p class="form-error" id="profile-error" role="alert" hidden></p>

          <button type="submit" class="btn btn--primary btn--block btn--lg" data-testid="save-profile">Save Profile</button>
        </form>

        <div class="danger-zone">
          <button type="button" class="btn btn--outline-light btn--block" data-action="logout">Log out</button>
          <button type="button" class="btn btn--danger btn--block" data-action="reset-demo">Reset demo data</button>
        </div>`;
    },
    /** Live-update macro target preview as the goal changes. */
    updateTargets() {
      const goal = parseInt($('#profile-goal').value, 10);
      if (!Validator.isValidGoal(goal)) return;
      const t = Nutrition.macroTargets(goal);
      $('#macro-targets').innerHTML = `<div><b>${t.protein}g</b>Protein</div><div><b>${t.carbs}g</b>Carbs</div><div><b>${t.fat}g</b>Fat</div>`;
    },
    save() {
      const user = Auth.currentUser();
      const name = $('#profile-name').value.trim();
      const email = $('#profile-email').value.trim().toLowerCase();
      const goal = Number($('#profile-goal').value);
      const userType = $('#profile-type').value;
      const errorEl = $('#profile-error');
      const fail = (msg, field) => {
        errorEl.textContent = msg;
        errorEl.hidden = false;
        document.querySelectorAll('#profile-form .input').forEach((i) => i.classList.remove('is-invalid'));
        if (field) $(field).classList.add('is-invalid');
      };

      if (!Validator.isValidName(name)) return fail('Name must be 2–50 characters.', '#profile-name');
      if (!Validator.isEmail(email)) return fail('Please enter a valid email address.', '#profile-email');
      const existing = UserRepository.findByEmail(email);
      if (existing && existing.id !== user.id) return fail('That email is already used by another account.', '#profile-email');
      if (!Validator.isValidGoal(goal)) {
        return fail(`Daily goal must be a whole number between ${CONFIG.MIN_GOAL} and ${CONFIG.MAX_GOAL}.`, '#profile-goal');
      }

      UserRepository.save({ ...user, name, email, dailyGoal: goal, userType });
      showToast('Profile saved');
      Router.refresh();
    },
    bind() {
      const root = $('#screen-profile');
      root.addEventListener('submit', (e) => {
        e.preventDefault();
        ProfileView.save();
      });
      root.addEventListener('input', (e) => {
        if (e.target.id === 'profile-goal') ProfileView.updateTargets();
      });
      root.addEventListener('click', (e) => {
        const goalInput = $('#profile-goal');
        const preset = e.target.closest('[data-goal]');
        if (preset) {
          goalInput.value = preset.dataset.goal;
          return ProfileView.updateTargets();
        }
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'goal-dec' || action === 'goal-inc') {
          const current = parseInt(goalInput.value, 10) || CONFIG.DEFAULT_GOAL;
          const next = current + (action === 'goal-inc' ? 50 : -50);
          goalInput.value = Math.min(CONFIG.MAX_GOAL, Math.max(CONFIG.MIN_GOAL, next));
          ProfileView.updateTargets();
        } else if (action === 'logout') {
          Auth.logout();
          showToast('Logged out');
          Router.go('login');
        } else if (action === 'reset-demo') {
          if (!window.confirm('Reset all demo data? This clears every account and meal stored in this browser.')) return;
          Storage.clearAll();
          seedDemoData();
          UIState.historyWeekOffset = 0;
          showToast('Demo data reset');
          Router.go('login');
        }
      });
    }
  };

  /* ---- Screen: Scan Food ------------------------------------------------- */

  /**
   * Illustrated sample plates (inline SVG → data URI) so the feature can be
   * demonstrated without a real photo. Each id matches a SCAN_DATASET entry.
   */
  const SAMPLE_PLATES = (() => {
    const plate = (inner, bg = '#E9DFC9') => `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
        <rect width="120" height="120" fill="${bg}"/>
        <circle cx="60" cy="60" r="50" fill="#D9D4CA"/><circle cx="60" cy="60" r="44" fill="#FFFFFF"/>
        ${inner}
      </svg>`;
    const svgs = {
      'chicken-rice-plate': plate(`
        <g fill="#FBF8F0" stroke="#E6DFD0" stroke-width="1">
          <circle cx="42" cy="66" r="9"/><circle cx="52" cy="72" r="9"/><circle cx="38" cy="76" r="8"/><circle cx="48" cy="60" r="8"/></g>
        <g fill="#C98B4A"><rect x="62" y="56" width="26" height="12" rx="6" transform="rotate(-20 75 62)"/>
          <rect x="64" y="70" width="26" height="12" rx="6" transform="rotate(-20 77 76)"/></g>
        <g stroke="#8A5427" stroke-width="2" stroke-linecap="round"><path d="M68 62l6-6M76 60l6-6M70 77l6-6M78 75l6-6"/></g>
        <g fill="#6DBE45"><circle cx="58" cy="36" r="7"/><circle cx="68" cy="38" r="6"/><circle cx="50" cy="40" r="5"/></g>
        <circle cx="62" cy="34" r="3" fill="#E5483B"/>`),
      'grilled-fish-plate': plate(`
        <ellipse cx="62" cy="64" rx="28" ry="13" fill="#F0B27A" transform="rotate(-12 62 64)"/>
        <g stroke="#B8703A" stroke-width="2" stroke-linecap="round"><path d="M46 70l8-10M56 70l8-10M66 68l8-10M76 66l6-8"/></g>
        <path d="M80 34a12 12 0 0 1 0 18z" fill="#F7D13A"/>
        <g fill="#6DBE45"><circle cx="40" cy="42" r="7"/><circle cx="50" cy="36" r="6"/><circle cx="36" cy="52" r="5"/></g>
        <g fill="#FBF8F0" stroke="#E6DFD0"><circle cx="52" cy="86" r="6"/><circle cx="62" cy="88" r="6"/></g>`),
      'pasta-bowl': plate(`
        <g fill="none" stroke="#EBC45A" stroke-width="5" stroke-linecap="round">
          <path d="M34 58c8-10 16 8 24-2s16 8 24-2"/><path d="M32 70c8-10 16 8 24-2s16 8 26-2"/><path d="M38 82c8-10 16 8 24-2s12 6 18 0"/></g>
        <circle cx="62" cy="64" r="14" fill="#C8432F" opacity="0.9"/>
        <g fill="#5BA83A"><ellipse cx="58" cy="58" rx="5" ry="3"/><ellipse cx="68" cy="66" rx="5" ry="3"/></g>`),
      'salad-bowl': plate(`
        <g fill="#6DBE45"><circle cx="46" cy="50" r="12"/><circle cx="66" cy="46" r="12"/><circle cx="74" cy="66" r="12"/><circle cx="52" cy="72" r="12"/><circle cx="60" cy="60" r="10"/></g>
        <g fill="#4E9A2E"><circle cx="40" cy="64" r="7"/><circle cx="78" cy="52" r="6"/></g>
        <g fill="#E5483B"><circle cx="56" cy="52" r="5"/><circle cx="70" cy="74" r="5"/><circle cx="44" cy="78" r="4"/></g>
        <g fill="#F4F1E6"><circle cx="66" cy="58" r="3"/><circle cx="50" cy="62" r="3"/></g>`),
      apple: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
          <rect width="120" height="120" fill="#F3EFE6"/>
          <path d="M60 40c-6-6-26-6-30 14s10 38 22 38c4 0 6-2 8-2s4 2 8 2c12 0 26-18 22-38S66 34 60 40z" fill="#D9342B"/>
          <path d="M44 50c-4 4-6 12-4 20" stroke="#F28A80" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M60 40c0-8 2-12 6-16" stroke="#6B4423" stroke-width="4" fill="none" stroke-linecap="round"/>
          <path d="M64 30c6-8 16-8 18-6-4 6-10 10-18 6z" fill="#5BA83A"/>
        </svg>`,
      banana: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
          <rect width="120" height="120" fill="#F3EFE6"/>
          <path d="M24 44c10 34 44 50 74 34 4-2 2-8-2-7-26 8-52-6-62-30-2-4-12-2-10 3z" fill="#F5CF3A"/>
          <path d="M30 48c12 26 38 38 62 30" stroke="#D9A91F" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M24 44l-4-6 6-2 4 5z" fill="#6B4423"/>
        </svg>`
    };
    return Object.fromEntries(
      Object.entries(svgs).map(([id, svg]) => [id, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.trim())}`])
    );
  })();

  /** Average colour of an image (downscaled to 24×24 on a canvas). */
  function averageImageColor(img) {
    try {
      const size = 24;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
      const n = data.length / 4;
      return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
    } catch (e) {
      return null; // canvas unavailable → recognizer falls back to default plate
    }
  }

  const SCAN_METHOD_LABEL = {
    sample: 'Sample plate',
    filename: 'Matched from image details',
    color: 'Matched by colour profile',
    default: 'Best guess'
  };
  const MAX_UPLOAD_MB = 10;

  const ScanView = {
    render(user) {
      const st = UIState.scan;
      if (!st.mealType) st.mealType = MealService.suggestMealType();
      const analyzing = st.status === 'analyzing';

      $('#scan-content').innerHTML = `
        <div class="scan-layout">
          <div class="col">
            <!-- Upload + preview + analyze -->
            <article class="card" aria-labelledby="scan-upload-title">
              <h2 class="section-title visually-hidden" id="scan-upload-title">Food image</h2>
              <div class="scan-preview${analyzing ? ' is-scanning' : ''}" data-testid="scan-preview">
                ${st.imageUrl
                  ? `<img src="${st.imageUrl}" alt="Preview of the selected food image">`
                  : `<div class="scan-preview__placeholder">
                       <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                       <span>No image selected</span>
                       <small>Upload a photo or try a sample plate</small>
                     </div>`}
                <span class="scan-preview__corner scan-preview__corner--tl"></span>
                <span class="scan-preview__corner scan-preview__corner--tr"></span>
                <span class="scan-preview__corner scan-preview__corner--bl"></span>
                <span class="scan-preview__corner scan-preview__corner--br"></span>
                ${analyzing ? '<div class="scan-preview__beam" aria-hidden="true"></div>' : ''}
              </div>
              ${st.fileName ? `<p class="scan-file-name">${escapeHtml(st.fileName)}</p>` : ''}
              <div class="scan-actions">
                <button type="button" class="btn btn--ghost btn--block" data-action="upload" data-testid="upload-image" ${analyzing ? 'disabled' : ''}>
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 20h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  ${st.imageUrl ? 'Change Image' : 'Upload Food Image'}
                </button>
                <button type="button" class="btn btn--primary btn--block btn--lg" data-action="analyze" data-testid="analyze-food" ${!st.imageUrl || analyzing ? 'disabled' : ''}>
                  ${analyzing ? 'Analyzing…' : 'Analyze Food'}
                </button>
              </div>
            </article>

            <!-- Sample plates for demonstrations -->
            <article class="card" aria-labelledby="sample-title">
              <div class="card__header">
                <h2 class="section-title" id="sample-title">Try a sample plate</h2>
                <span class="card__meta">For demos</span>
              </div>
              <div class="sample-grid">
                ${Object.entries(SCAN_DATASET).map(([id, plate]) => `
                  <button type="button" class="sample-btn${st.sampleId === id ? ' is-active' : ''}" data-sample="${id}" ${analyzing ? 'disabled' : ''}>
                    <img src="${SAMPLE_PLATES[id]}" alt="">
                    ${escapeHtml(plate.label)}
                  </button>`).join('')}
              </div>
            </article>
          </div>

          <div class="col">
            ${ScanView.resultsHtml(user)}
          </div>
        </div>`;
    },

    /** Results card: empty state, loading skeleton, or detected foods. */
    resultsHtml(user) {
      const st = UIState.scan;

      if (st.status === 'analyzing') {
        return `
          <article class="card" aria-busy="true">
            <h2 class="section-title">Analyzing your plate…</h2>
            <p class="muted">Detecting foods and estimating portions</p>
            <div class="skeleton"></div><div class="skeleton" style="width:80%"></div><div class="skeleton" style="width:60%"></div>
          </article>`;
      }

      if (st.status !== 'done' || !st.result) {
        return `
          <article class="card" aria-labelledby="scan-how-title">
            <h2 class="section-title" id="scan-how-title">How it works</h2>
            <ol class="scan-steps">
              <li>Upload a photo of your meal or pick a sample plate</li>
              <li>Tap <strong>Analyze Food</strong> to identify the foods</li>
              <li>Check the portions, then <strong>Add To Meal</strong></li>
            </ol>
          </article>`;
      }

      const { result, mealType } = st;
      const totals = FoodRecognizer.totals(result.items);
      const included = result.items.filter((i) => i.included).length;
      const after = MealService.dayTotals(user.id, DateUtil.todayKey()).calories + totals.calories;

      return `
        <article class="card" aria-labelledby="scan-result-title" data-testid="scan-results">
          <h2 class="section-title" id="scan-result-title">Scan Results</h2>
          <div class="detected-label" data-testid="scan-label">${escapeHtml(result.label)}</div>
          <p class="detected-meta">${result.items.length} food${result.items.length === 1 ? '' : 's'} detected · ${SCAN_METHOD_LABEL[result.method]}</p>

          ${result.items.map((item, index) => {
            const n = Nutrition.scale(FoodService.getById(item.foodId), item.servings);
            return `
              <div class="detected-item${item.included ? '' : ' is-excluded'}" data-testid="detected-item">
                <input type="checkbox" class="detected-item__check" data-toggle-item="${index}" ${item.included ? 'checked' : ''}
                  aria-label="Include ${escapeHtml(item.name)}">
                <div class="detected-item__info">
                  <div class="detected-item__name">${escapeHtml(item.name)} <span class="badge badge--confidence">${item.confidence}% match</span></div>
                  <div class="detected-item__sub">P ${Format.grams(n.protein)} · C ${Format.grams(n.carbs)} · F ${Format.grams(n.fat)}</div>
                  <div class="mini-stepper" role="group" aria-label="Portion of ${escapeHtml(item.name)}">
                    <button type="button" data-portion="${index}" data-delta="-1" aria-label="Decrease portion">−</button>
                    <span>${Format.servings(item.servings)} × ${escapeHtml(item.serving.split(' (')[0])}</span>
                    <button type="button" data-portion="${index}" data-delta="1" aria-label="Increase portion">+</button>
                  </div>
                </div>
                <div class="detected-item__kcal">${n.calories} kcal</div>
              </div>`;
          }).join('')}

          <div class="scan-totals">
            <div class="scan-totals__kcal">
              <strong data-testid="scan-calories">${Format.kcal(totals.calories)}</strong>
              <span>total calories</span>
            </div>
            <div class="macro-grid">
              <div class="macro-tile" style="--tile-color:${MACRO_COLORS.protein}">
                <div class="macro-tile__value" data-testid="scan-protein">${Format.grams(totals.protein)}</div><div class="macro-tile__label">Protein</div>
              </div>
              <div class="macro-tile" style="--tile-color:${MACRO_COLORS.carbs}">
                <div class="macro-tile__value" data-testid="scan-carbs">${Format.grams(totals.carbs)}</div><div class="macro-tile__label">Carbohydrates</div>
              </div>
              <div class="macro-tile" style="--tile-color:${MACRO_COLORS.fat}">
                <div class="macro-tile__value" data-testid="scan-fat">${Format.grams(totals.fat)}</div><div class="macro-tile__label">Fat</div>
              </div>
            </div>
          </div>

          <div class="field">
            <span class="field__label" id="scan-mealtype-label">Meal</span>
            <div class="segmented" role="radiogroup" aria-labelledby="scan-mealtype-label">
              ${CONFIG.MEAL_TYPES.map((t) => `
                <button type="button" class="segmented__btn${t === mealType ? ' is-active' : ''}" role="radio"
                  aria-checked="${t === mealType}" data-scan-meal-type="${t}">${t}</button>`).join('')}
            </div>
          </div>

          <p class="field__hint">Today after adding: <strong>${Format.kcal(after)}</strong> / ${Format.kcal(user.dailyGoal)} kcal</p>

          <button type="button" class="btn btn--primary btn--block btn--lg" data-action="scan-add" data-testid="scan-add-to-meal"
            style="margin-top:var(--space-4)" ${included ? '' : 'disabled'}>
            Add To Meal · ${Format.kcal(totals.calories)} kcal
          </button>

          <p class="scan-note" data-testid="scan-note">
            <strong>Prototype Demonstration:</strong> Food recognition results are simulated for academic purposes.
          </p>
        </article>`;
    },

    /** Set a new image source and clear any previous result. */
    setImage({ imageUrl, fileName = '', sampleId = null, avgColor = null }) {
      const st = UIState.scan;
      if (st.imageUrl && st.imageUrl.startsWith('blob:')) URL.revokeObjectURL(st.imageUrl);
      Object.assign(st, { imageUrl, fileName, sampleId, avgColor, status: 'idle', result: null });
      st.token += 1; // cancels any analysis still running
      Router.refresh();
    },

    /** Validate and load a user-selected image file. */
    handleFile(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) return showToast('Please choose an image file (JPG, PNG, HEIC…).', 'error');
      if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return showToast(`Image is larger than ${MAX_UPLOAD_MB} MB.`, 'error');

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => ScanView.setImage({ imageUrl: url, fileName: file.name, avgColor: averageImageColor(img) });
      img.onerror = () => {
        URL.revokeObjectURL(url);
        showToast('This image could not be opened. Try a JPG or PNG.', 'error');
      };
      img.src = url;
    },

    /** Run the simulated recognizer after a short "processing" delay. */
    analyze() {
      const st = UIState.scan;
      if (!st.imageUrl || st.status === 'analyzing') return;
      st.status = 'analyzing';
      const token = ++st.token;
      Router.refresh();

      setTimeout(() => {
        if (token !== st.token) return; // image changed meanwhile
        st.result = FoodRecognizer.analyze({ sampleId: st.sampleId, fileName: st.fileName, avgColor: st.avgColor });
        st.status = 'done';
        if (Router.parse().name === 'scan') {
          Router.refresh();
          // On phones the results card sits below the image — bring it into view
          $('[data-testid="scan-results"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 1400);
    },

    /** Log every included item as a meal entry (source: 'scan'). */
    addToMeal() {
      const user = Auth.currentUser();
      const st = UIState.scan;
      const items = (st.result?.items || []).filter((i) => i.included);
      if (!items.length) return showToast('Select at least one detected food.', 'error');

      let added = 0;
      for (const item of items) {
        const res = MealService.addMeal({
          userId: user.id, foodId: item.foodId, servings: item.servings, mealType: st.mealType, source: 'scan'
        });
        if (!res.ok) return showToast(res.error, 'error');
        added += res.entry.calories;
      }
      showToast(`Added ${items.length} scanned item${items.length === 1 ? '' : 's'} to ${st.mealType} (+${Format.kcal(added)} kcal)`);

      if (st.imageUrl && st.imageUrl.startsWith('blob:')) URL.revokeObjectURL(st.imageUrl);
      UIState.scan = { imageUrl: null, fileName: '', sampleId: null, avgColor: null, status: 'idle', result: null, mealType: null, token: st.token + 1 };
      Router.go('dashboard');
    },

    bind() {
      const root = $('#screen-scan');
      const fileInput = $('#scan-file');

      fileInput.addEventListener('change', () => {
        ScanView.handleFile(fileInput.files[0]);
        fileInput.value = ''; // allow re-selecting the same file
      });

      root.addEventListener('change', (e) => {
        const toggle = e.target.closest('[data-toggle-item]');
        if (!toggle) return;
        UIState.scan.result.items[Number(toggle.dataset.toggleItem)].included = toggle.checked;
        Router.refresh();
      });

      root.addEventListener('click', (e) => {
        const st = UIState.scan;
        const sample = e.target.closest('[data-sample]');
        if (sample) return ScanView.setImage({ imageUrl: SAMPLE_PLATES[sample.dataset.sample], fileName: '', sampleId: sample.dataset.sample });

        const portion = e.target.closest('[data-portion]');
        if (portion) {
          const item = st.result.items[Number(portion.dataset.portion)];
          const next = item.servings + Number(portion.dataset.delta) * CONFIG.SERVING_STEP;
          item.servings = Math.min(CONFIG.MAX_SERVINGS, Math.max(CONFIG.SERVING_STEP, next));
          return Router.refresh();
        }

        const mealTypeBtn = e.target.closest('[data-scan-meal-type]');
        if (mealTypeBtn) {
          st.mealType = mealTypeBtn.dataset.scanMealType;
          return Router.refresh();
        }

        switch (e.target.closest('[data-action]')?.dataset.action) {
          case 'upload': return fileInput.click();
          case 'analyze': return ScanView.analyze();
          case 'scan-add': return ScanView.addToMeal();
        }
      });
    }
  };

  /* ==========================================================================
     8. ROUTER — hash-based navigation with authentication guard
     ========================================================================== */
  const ROUTES = {
    login: { screen: 'login', view: LoginView, title: 'Login', public: true },
    dashboard: { screen: 'dashboard', view: DashboardView, title: 'Dashboard', nav: 'dashboard' },
    search: { screen: 'search', view: SearchView, title: 'Search Food', nav: 'search' },
    food: { screen: 'food', view: FoodView, title: 'Food Details', nav: 'search' },
    history: { screen: 'history', view: HistoryView, title: 'Nutrition History', nav: 'history' },
    profile: { screen: 'profile', view: ProfileView, title: 'Profile', nav: 'profile' },
    scan: { screen: 'scan', view: ScanView, title: 'Scan Food', nav: 'scan' }
  };

  const Router = {
    parse() {
      const [name, param] = location.hash.replace(/^#\/?/, '').split('/');
      return { name: name || 'dashboard', param: param ? decodeURIComponent(param) : null };
    },
    go(path) {
      if (location.hash === `#/${path}`) Router.refresh();
      else location.hash = `#/${path}`;
    },
    /** Replace the current history entry (used for redirects). */
    redirect(path) {
      location.replace(`#/${path}`);
    },
    refresh() {
      Router.render({ preserveScroll: true });
    },
    render({ preserveScroll = false } = {}) {
      const { name, param } = Router.parse();
      const route = ROUTES[name];
      const user = Auth.currentUser();

      // Guards
      if (!route) return Router.redirect(user ? 'dashboard' : 'login');
      if (!route.public && !user) return Router.redirect('login');
      if (name === 'login' && user) return Router.redirect('dashboard');

      // Toggle shell visibility
      const loggedInScreen = !route.public;
      $('#screen-login').hidden = loggedInScreen;
      $('#app-main').hidden = !loggedInScreen;
      $('#bottom-nav').hidden = !loggedInScreen;
      document.querySelectorAll('.app-main > .screen').forEach((s) => {
        s.hidden = s.dataset.screen !== route.screen;
      });

      // Active nav state
      document.querySelectorAll('[data-nav]').forEach((a) => {
        const active = a.dataset.nav === route.nav;
        a.classList.toggle('is-active', active);
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });

      route.view.render(user, param);
      document.title = `${route.title} · Enhanced Calorie Tracking System`;
      if (!preserveScroll) window.scrollTo(0, 0);
    }
  };

  /* ==========================================================================
     9. BOOTSTRAP
     ========================================================================== */
  function init() {
    seedDemoData();
    [LoginView, DashboardView, SearchView, FoodView, HistoryView, ProfileView, ScanView, ForgotModal]
      .forEach((v) => v.bind());
    window.addEventListener('hashchange', () => Router.render());
    Router.render();
  }

  // Public API for automated tests and debugging in the console
  window.ECTS = {
    CONFIG, FOOD_DATABASE, DateUtil, Validator, Format, Storage,
    UserRepository, MealRepository, Auth, FoodService, Nutrition, MealService,
    FoodRecognizer, SCAN_DATASET,
    seedDemoData, escapeHtml
  };

  // Only start the UI when the app shell exists (not inside the test runner)
  if (document.getElementById('app')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }
})();
