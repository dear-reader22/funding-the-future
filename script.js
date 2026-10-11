
/* =========================================================
   FUNDING THE FUTURE 🍒
   Fresh build — jars, goals, finds, money & local storage
   ========================================================= */

(() => {
  "use strict";

  /* -------------------------------------------------------
     1. CONSTANTS & DEFAULT DATA
  ------------------------------------------------------- */

  const STORAGE_JARS = "futureJars";
  const STORAGE_FINDS = "futureWishlist";

  const DEFAULT_JARS = [
    { id: 1, name: "Spending Wages", icon: "💳", balance: 0, goal: 0, isDefault: true },
    { id: 2, name: "Saving Wages", icon: "💷", balance: 0, goal: 0, isDefault: true },
    { id: 3, name: "Tips", icon: "🪙", balance: 0, goal: 0, isDefault: true },
    { id: 4, name: "Other Money", icon: "🎂", balance: 0, goal: 0, isDefault: true }
  ];

  const CATEGORIES = [
    "Tiny Treat",
    "Small Spend",
    "Worth the Splurge",
    "Slight Sting",
    "Dream Purchase"
  ];

  const PRIORITIES = [
    "Need it now",
    "Buying soon",
    "Could wait",
    "Seasonal",
    "Planning ahead"
  ];

  const moneyFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  });

  /* -------------------------------------------------------
     2. DOM REFERENCES
  ------------------------------------------------------- */

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  const modalBackdrop = $("#modal-backdrop");
  const modalForm = $("#modal-form");
  const modalFields = $("#modal-fields");
  const modalTitle = $("#modal-title");
  const modalEyebrow = $("#modal-eyebrow");
  const modalDescription = $("#modal-description");
  const modalError = $("#modal-error");
  const modalSubmit = $("#modal-submit");
  const modalClose = $("#modal-close");
  const modalCancel = $("#modal-cancel");
  const toastRegion = $("#toast-region");

  /* -------------------------------------------------------
     3. SAFE DATA LOADING & NORMALISATION
  ------------------------------------------------------- */

  function readStoredJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { exists: false, value: null };
      return { exists: true, value: JSON.parse(raw) };
    } catch (error) {
      console.warn(`Could not read ${key}:`, error);
      return { exists: true, value: null, invalid: true };
    }
  }

  function normaliseMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.round(number * 100) / 100;
  }

  function normaliseJar(jar, index) {
    if (!jar || typeof jar !== "object") return null;

    const id = jar.id ?? jar.jarId ?? `legacy-${index + 1}`;
    const name = String(jar.name ?? jar.title ?? `My Jar ${index + 1}`).trim();

    if (!name) return null;

    const isDefault =
      jar.isDefault === true ||
      jar.default === true ||
      (typeof id === "number" && id >= 1 && id <= 4);

    return {
      ...jar,
      id,
      name,
      icon: String(jar.icon ?? jar.emoji ?? jar.symbol ?? "🍒"),
      balance: normaliseMoney(jar.balance ?? jar.amount ?? jar.money ?? 0),
      goal: normaliseMoney(jar.goal ?? jar.target ?? jar.goalAmount ?? 0),
      isDefault
    };
  }

  function normaliseFind(item, index) {
    if (!item || typeof item !== "object") return null;

    const name = String(item.name ?? item.title ?? item.item ?? "").trim();
    if (!name) return null;

    const price = normaliseMoney(item.price ?? item.cost ?? item.amount ?? 0);

    return {
      ...item,
      id: item.id ?? item.findId ?? `legacy-find-${index + 1}`,
      name,
      price,
      category: CATEGORIES.includes(item.category)
        ? item.category
        : "Small Spend",
      priority: PRIORITIES.includes(item.priority)
        ? item.priority
        : "Could wait",
      saved: Math.min(
        price,
        normaliseMoney(
          item.saved ?? item.savedAmount ?? item.amountSaved ?? item.funded ?? 0
        )
      )
    };
  }

  const storedJars = readStoredJSON(STORAGE_JARS);
  const storedFinds = readStoredJSON(STORAGE_FINDS);

  let jars = Array.isArray(storedJars.value)
    ? storedJars.value.map(normaliseJar).filter(Boolean)
    : storedJars.exists
      ? []
      : DEFAULT_JARS.map(jar => ({ ...jar }));

  let finds = Array.isArray(storedFinds.value)
    ? storedFinds.value.map(normaliseFind).filter(Boolean)
    : [];

  // If old data exists but has no usable jars, restore the four essentials.
  if (jars.length === 0) {
    jars = DEFAULT_JARS.map(jar => ({ ...jar }));
  }

  let activePage = "overview";
  let activeFilter = "all";
  let modalSubmitHandler = null;
  let previousFocus = null;
  let toastCounter = 0;

  /* -------------------------------------------------------
     4. GENERAL HELPERS
  ------------------------------------------------------- */

  function formatMoney(value) {
    return moneyFormatter.format(normaliseMoney(value));
  }

  function toCents(value) {
    return Math.round(normaliseMoney(value) * 100);
  }

  function fromCents(value) {
    return Math.round(value) / 100;
  }

  function makeId(prefix = "item") {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_JARS, JSON.stringify(jars));
      localStorage.setItem(STORAGE_FINDS, JSON.stringify(finds));
      return true;
    } catch (error) {
      console.error("Could not save your data:", error);
      showToast("Your changes couldn't be saved on this device.", "error");
      return false;
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }
    return element;
  }

  function createButton(text, className, action, id) {
    const button = createElement("button", className, text);
    button.type = "button";
    button.dataset.action = action;
    if (id !== undefined) button.dataset.id = String(id);
    return button;
  }

  function findJar(id) {
    return jars.find(jar => String(jar.id) === String(id));
  }

  function findFind(id) {
    return finds.find(item => String(item.id) === String(id));
  }

  function totalBalance() {
    return fromCents(jars.reduce((sum, jar) => sum + toCents(jar.balance), 0));
  }

  function totalSavedForFinds() {
    return fromCents(finds.reduce((sum, item) => sum + toCents(item.saved), 0));
  }

  function remainingForFind(item) {
    return Math.max(0, fromCents(toCents(item.price) - toCents(item.saved)));
  }

  function percentage(saved, target) {
    if (target <= 0) return 0;
    return Math.min(100, Math.round((saved / target) * 100));
  }

  function showToast(message, type = "success") {
    if (!toastRegion) return;

    const toast = createElement("div", `toast toast-${type}`, message);
    const thisToast = ++toastCounter;
    toast.dataset.toast = String(thisToast);
    toastRegion.appendChild(toast);

    window.setTimeout(() => {
      const currentToast = $(`[data-toast="${thisToast}"]`, toastRegion);
      if (currentToast) currentToast.remove();
    }, 3500);
  }

  function showFormError(message) {
    modalError.textContent = message;
    modalError.hidden = false;
  }

  function clearFormError() {
    modalError.textContent = "";
    modalError.hidden = true;
  }

  /* -------------------------------------------------------
     5. DYNAMIC MODAL FIELDS
  ------------------------------------------------------- */

  function addField({
    label,
    name,
    type = "text",
    placeholder = "",
    value = "",
    required = false,
    min,
    max,
    step,
    hint,
    options,
    autocomplete
  }) {
    const wrapper = createElement("div", "form-field");
    const id = `field-${name}`;

    const fieldLabel = createElement("label", "", label);
    fieldLabel.htmlFor = id;
    wrapper.appendChild(fieldLabel);

    let control;

    if (type === "select") {
      control = createElement("select");
      control.id = id;
      control.name = name;
      control.className = "form-control";

      (options || []).forEach(optionData => {
        const option = document.createElement("option");

        if (typeof optionData === "string") {
          option.value = optionData;
          option.textContent = optionData;
        } else {
          option.value = optionData.value;
          option.textContent = optionData.label;
        }

        control.appendChild(option);
      });

      if (value !== "") control.value = value;
    } else {
      control = createElement("input");
      control.type = type;
      control.id = id;
      control.name = name;
      control.placeholder = placeholder;
      control.value = value;
      if (min !== undefined) control.min = String(min);
      if (max !== undefined) control.max = String(max);
      if (step !== undefined) control.step = String(step);
      if (autocomplete) control.autocomplete = autocomplete;
    }

    control.required = required;
    wrapper.appendChild(control);

    if (hint) {
      wrapper.appendChild(createElement("small", "field-hint", hint));
    }

    modalFields.appendChild(wrapper);
    return control;
  }

  function openModal({
    eyebrow = "A LITTLE SOMETHING",
    title,
    description = "",
    submitText = "Save",
    fields = [],
    onSubmit
  }) {
    previousFocus = document.activeElement;
    modalSubmitHandler = onSubmit;

    modalEyebrow.textContent = eyebrow;
    modalTitle.replaceChildren(
      document.createTextNode(title),
      createElement("span", "heading-period", ".")
    );
    modalDescription.textContent = description;
    modalSubmit.textContent = submitText;
    modalFields.replaceChildren();
    clearFormError();

    fields.forEach(field => addField(field));

    modalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";

    const firstField = $("input, select, textarea", modalFields);
    if (firstField) {
      window.setTimeout(() => firstField.focus(), 30);
    } else {
      modalClose.focus();
    }
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    document.body.style.overflow = "";
    modalSubmitHandler = null;

    if (previousFocus && typeof previousFocus.focus === "function") {
      previousFocus.focus();
    }
  }

  modalClose.addEventListener("click", closeModal);
  modalCancel.addEventListener("click", closeModal);

  modalBackdrop.addEventListener("click", event => {
    if (event.target === modalBackdrop) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modalBackdrop.hidden) {
      closeModal();
    }
  });

  modalForm.addEventListener("submit", event => {
    event.preventDefault();
    clearFormError();

    if (typeof modalSubmitHandler !== "function") return;

    const formData = new FormData(modalForm);
    const result = modalSubmitHandler(formData);

    if (result !== false) {
      closeModal();
    }
  });

  /* -------------------------------------------------------
     6. NAVIGATION
  ------------------------------------------------------- */

  function showPage(pageName) {
    const validPages = ["overview", "jars", "finds"];
    if (!validPages.includes(pageName)) return;

    activePage = pageName;

    $$(".page").forEach(page => {
      page.classList.toggle("active", page.dataset.section === pageName);
    });

    $$(".nav-link").forEach(button => {
      const isActive = button.dataset.page === pageName;
      button.classList.toggle("active", isActive);

      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");
    if (!pageButton) return;

    if (pageButton.tagName === "A") event.preventDefault();
    showPage(pageButton.dataset.page);
  });

  /* -------------------------------------------------------
     7. JAR CARD RENDERING
  ------------------------------------------------------- */

  function buildJarCard(jar, compact = false) {
    const card = createElement("article", `jar-card${compact ? " jar-card-compact" : ""}`);
    card.dataset.id = String(jar.id);

    const top = createElement("div", "jar-card-top");
    const identity = createElement("div", "jar-identity");
    identity.appendChild(createElement("span", "jar-emoji", jar.icon));
    const nameBlock = createElement("div");
    nameBlock.appendChild(createElement("h3", "jar-name", jar.name));
    nameBlock.appendChild(
      createElement("p", "jar-type", jar.isDefault ? "Your money, your way" : "Personal jar")
    );
    identity.appendChild(nameBlock);
    top.appendChild(identity);

    if (!jar.isDefault) {
      top.appendChild(createButton("•••", "icon-button jar-menu", "delete-jar", jar.id));
    }

    card.appendChild(top);

    const balanceLabel = createElement("p", "jar-balance-label", "CURRENT BALANCE");
    card.appendChild(balanceLabel);
    card.appendChild(createElement("p", "jar-balance", formatMoney(jar.balance)));

    const progressSection = createElement("div", "jar-progress-section");

    if (jar.goal > 0) {
      const progressTop = createElement("div", "progress-topline");
      progressTop.appendChild(createElement("span", "", "Goal progress"));
      progressTop.appendChild(
        createElement("span", "", `${percentage(jar.balance, jar.goal)}%`)
      );
      progressSection.appendChild(progressTop);

      const track = createElement("div", "progress-track");
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${jar.name} savings goal`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "100");
      track.setAttribute("aria-valuenow", String(percentage(jar.balance, jar.goal)));

      const fill = createElement("div", "progress-fill");
      fill.style.width = `${percentage(jar.balance, jar.goal)}%`;
      track.appendChild(fill);
      progressSection.appendChild(track);

      const remaining = Math.max(0, fromCents(toCents(jar.goal) - toCents(jar.balance)));
      progressSection.appendChild(
        createElement(
          "p",
          "jar-progress-empty",
          remaining === 0
            ? "Goal reached — lovely!"
            : `${formatMoney(remaining)} to go`
        )
      );
    } else {
      progressSection.appendChild(
        createElement("p", "jar-progress-empty", "No savings goal set yet")
      );
    }

    card.appendChild(progressSection);

    const actions = createElement("div", "jar-card-actions");
    actions.appendChild(createButton("+ Add money", "button button-red", "add-money", jar.id));
    actions.appendChild(
      createButton("− Take out", "button button-soft", "remove-money", jar.id)
    );
    actions.appendChild(
      createButton(jar.goal > 0 ? "Edit goal" : "Set a goal", "jar-delete", "edit-goal", jar.id)
    );
    card.appendChild(actions);

    return card;
  }

  function renderJars() {
    const allJars = $("#all-jars");
    const overviewJars = $("#overview-jars");
    if (!allJars || !overviewJars) return;

    allJars.replaceChildren();
    overviewJars.replaceChildren();

    jars.forEach(jar => allJars.appendChild(buildJarCard(jar)));
    jars.slice(0, 4).forEach(jar => {
      overviewJars.appendChild(buildJarCard(jar, true));
    });

    const count = $("#jars-count");
    if (count) count.textContent = `${jars.length} ${jars.length === 1 ? "jar" : "jars"}`;
  }

  /* -------------------------------------------------------
     8. FIND CARD RENDERING
  ------------------------------------------------------- */

  function buildFindCard(item, compact = false) {
    const card = createElement("article", `find-card${compact ? " find-card-compact" : ""}`);
    card.dataset.id = String(item.id);

    const top = createElement("div", "find-card-top");
    const category = createElement("span", "find-category", item.category);
    category.dataset.category = item.category;
    top.appendChild(category);
    top.appendChild(createElement("span", "find-priority", item.priority));
    card.appendChild(top);

    card.appendChild(createElement("h3", "find-title", item.name));
    card.appendChild(createElement("p", "find-price", formatMoney(item.price)));

    const progress = createElement("div", "find-progress");
    const progressTop = createElement("div", "progress-topline");
    progressTop.appendChild(createElement("span", "", "Saved so far"));
    progressTop.appendChild(
      createElement("span", "", `${percentage(item.saved, item.price)}%`)
    );
    progress.appendChild(progressTop);

    const track = createElement("div", "progress-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `Savings progress for ${item.name}`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(percentage(item.saved, item.price)));

    const fill = createElement("div", "progress-fill");
    fill.style.width = `${percentage(item.saved, item.price)}%`;
    track.appendChild(fill);
    progress.appendChild(track);

    const remaining = remainingForFind(item);
    progress.appendChild(
      createElement(
        "p",
        "find-progress-note",
        remaining === 0
          ? `Fully funded · ${formatMoney(item.saved)} saved`
          : `${formatMoney(item.saved)} saved · ${formatMoney(remaining)} to go`
      )
    );

    card.appendChild(progress);

    const actions = createElement("div", "find-card-actions");

    if (remaining > 0) {
      actions.appendChild(
        createButton("Add savings", "button button-red", "fund-find", item.id)
      );
    } else {
      actions.appendChild(
        createElement("span", "find-funded-label", "✓ Fully funded")
      );
    }

    actions.appendChild(
      createButton("Remove", "button button-soft", "delete-find", item.id)
    );

    card.appendChild(actions);
    return card;
  }

  function getFilteredFinds() {
    return activeFilter === "all"
      ? finds
      : finds.filter(item => item.category === activeFilter);
  }

  function renderFinds() {
    const allFinds = $("#all-finds");
    const overviewFinds = $("#overview-finds");
    if (!allFinds || !overviewFinds) return;

    allFinds.replaceChildren();
    overviewFinds.replaceChildren();

    const filtered = getFilteredFinds();

    filtered.forEach(item => allFinds.appendChild(buildFindCard(item)));
    finds.slice(0, 3).forEach(item => {
      overviewFinds.appendChild(buildFindCard(item, true));
    });

    const count = $("#finds-count");
    if (count) {
      count.textContent = `${finds.length} ${finds.length === 1 ? "find" : "finds"}`;
    }

    const savedTotal = $("#finds-saved-total");
    if (savedTotal) savedTotal.textContent = formatMoney(totalSavedForFinds());

    $$("#finds-filters [data-filter]").forEach(button => {
      const selected = button.dataset.filter === activeFilter;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });

    if (finds.length === 0) {
      allFinds.appendChild(
        createEmptyState("♡", "Your wishlist starts here", "Add a find you’re saving towards.")
      );
    } else if (filtered.length === 0) {
      allFinds.appendChild(
        createEmptyState("✳", "Nothing in this category yet", "Try another filter.")
      );
    }

    if (finds.length === 0) {
      overviewFinds.appendChild(
        createEmptyState("♡", "A little wish list", "Save the things you’re dreaming of.")
      );
    }
  }

  function createEmptyState(icon, title, description) {
    const empty = createElement("div", "empty-state");
    empty.appendChild(createElement("span", "empty-state-icon", icon));
    empty.appendChild(createElement("h3", "", title));
    empty.appendChild(createElement("p", "", description));
    return empty;
  }

  /* -------------------------------------------------------
     9. OVERVIEW STATS
  ------------------------------------------------------- */

  function renderOverview() {
    const total = $("#overview-total");
    const goals = $("#overview-goals");
    const findCount = $("#overview-finds");

    if (total) total.textContent = formatMoney(totalBalance());
    if (goals) {
      goals.textContent = String(jars.filter(jar => jar.goal > 0).length);
    }
    if (findCount) findCount.textContent = String(finds.length);
  }

  function renderAll() {
    renderJars();
    renderFinds();
    renderOverview();
  }

  /* -------------------------------------------------------
     10. ADD A JAR
  ------------------------------------------------------- */

  function openAddJarModal() {
    openModal({
      eyebrow: "A NEW LITTLE POT",
      title: "Make room for more.",
      description: "Give this jar a name and, if you like, a savings goal.",
      submitText: "Create jar",
      fields: [
        {
          label: "Jar name",
          name: "name",
          placeholder: "e.g. Summer in Paris",
          required: true
        },
        {
          label: "Icon or emoji",
          name: "icon",
          placeholder: "🍒",
          value: "🍒",
          hint: "One little symbol to make it yours."
        },
        {
          label: "Savings goal (£)",
          name: "goal",
          type: "number",
          placeholder: "e.g. 250",
          min: 0,
          step: "0.01",
          hint: "Optional — leave at 0 if you don't need a target."
        }
      ],
      onSubmit(data) {
        const name = String(data.get("name") || "").trim();
        const icon = String(data.get("icon") || "").trim() || "🍒";
        const goalText = String(data.get("goal") || "").trim();
        const goal = goalText === "" ? 0 : Number(goalText);

        if (!name) return showFormError("Give your jar a name first."), false;
        if (name.length > 50) return showFormError("Keep the jar name under 50 characters."), false;
        if (!Number.isFinite(goal) || goal < 0) {
          return showFormError("Enter a valid goal of £0 or more."), false;
        }

        jars.push({
          id: makeId("jar"),
          name,
          icon: icon.slice(0, 8),
          balance: 0,
          goal: normaliseMoney(goal),
          isDefault: false
        });

        saveData();
        renderAll();
        showToast(`${name} is ready for its first deposit.`);
      }
    });
  }

  /* -------------------------------------------------------
     11. ADD OR REMOVE MONEY
  ------------------------------------------------------- */

  function openMoneyModal(jarId, mode) {
    const jar = findJar(jarId);
    if (!jar) return;

    const adding = mode === "add";
    const verb = adding ? "Add money" : "Take money out";

    openModal({
      eyebrow: adding ? "A LITTLE DEPOSIT" : "A LITTLE WITHDRAWAL",
      title: adding ? "Look at you, saving." : "Money on the move.",
      description: adding
        ? `Add money to ${jar.name}. Every little bit counts.`
        : `Take money out of ${jar.name}. Your balance is ${formatMoney(jar.balance)}.`,
      submitText: adding ? "Add to jar" : "Take out",
      fields: [
        {
          label: "Amount (£)",
          name: "amount",
          type: "number",
          placeholder: "0.00",
          min: "0.01",
          step: "0.01",
          required: true
        }
      ],
      onSubmit(data) {
        const amount = Number(data.get("amount"));
        const amountCents = Math.round(amount * 100);

        if (!Number.isFinite(amount) || amountCents <= 0) {
          return showFormError("Enter an amount greater than £0."), false;
        }

        const balanceCents = toCents(jar.balance);

        if (!adding && amountCents > balanceCents) {
          return showFormError(
            `There isn't enough money in this jar. You have ${formatMoney(jar.balance)}.`
          ), false;
        }

        jar.balance = fromCents(
          adding ? balanceCents + amountCents : balanceCents - amountCents
        );

        saveData();
        renderAll();
        showToast(
          adding
            ? `${formatMoney(amount)} added to ${jar.name}.`
            : `${formatMoney(amount)} taken out of ${jar.name}.`
        );
      }
    });
  }

  /* -------------------------------------------------------
     12. SET OR EDIT A SAVINGS GOAL
  ------------------------------------------------------- */

  function openGoalModal(jarId) {
    const jar = findJar(jarId);
    if (!jar) return;

    openModal({
      eyebrow: "A LITTLE SOMETHING TO AIM FOR",
      title: jar.goal > 0 ? "Change the goal." : "Dream it up.",
      description: `Set a target for ${jar.name}. Enter £0 to remove the goal.`,
      submitText: "Save goal",
      fields: [
        {
          label: "Savings target (£)",
          name: "goal",
          type: "number",
          placeholder: "e.g. 300",
          min: 0,
          step: "0.01",
          value: jar.goal,
          required: true
        }
      ],
      onSubmit(data) {
        const goal = Number(data.get("goal"));

        if (!Number.isFinite(goal) || goal < 0) {
          return showFormError("Enter a valid goal of £0 or more."), false;
        }

        jar.goal = normaliseMoney(goal);
        saveData();
        renderAll();

        showToast(
          goal === 0
            ? `Savings goal removed from ${jar.name}.`
            : `Your goal for ${jar.name} is ${formatMoney(goal)}.`
        );
      }
    });
  }

  /* -------------------------------------------------------
     13. DELETE A JAR SAFELY
  ------------------------------------------------------- */

  function openDeleteJarModal(jarId) {
    const jar = findJar(jarId);
    if (!jar || jar.isDefault) return;

    const otherJars = jars.filter(other => String(other.id) !== String(jar.id));

    if (toCents(jar.balance) > 0 && otherJars.length > 0) {
      openModal({
        eyebrow: "A LITTLE HOUSEKEEPING",
        title: "Move the money first.",
        description: `${jar.name} still holds ${formatMoney(jar.balance)}. Choose where to move it before deleting this jar.`,
        submitText: "Move & delete",
        fields: [
          {
            label: "Move the balance to",
            name: "destination",
            type: "select",
            required: true,
            options: otherJars.map(other => ({
              value: String(other.id),
              label: `${other.icon} ${other.name} · ${formatMoney(other.balance)}`
            }))
          }
        ],
        onSubmit(data) {
          const destination = findJar(data.get("destination"));

          if (!destination || String(destination.id) === String(jar.id)) {
            return showFormError("Choose another jar to receive the balance."), false;
          }

          destination.balance = fromCents(
            toCents(destination.balance) + toCents(jar.balance)
          );

          jars = jars.filter(other => String(other.id) !== String(jar.id));
          saveData();
          renderAll();
          showToast(`${formatMoney(jar.balance)} moved to ${destination.name}.`);
        }
      });
      return;
    }

    openModal({
      eyebrow: "ARE YOU SURE?",
      title: "Say goodbye to this jar?",
      description: `Delete ${jar.name}? This can't be undone.`,
      submitText: "Delete jar",
      fields: [],
      onSubmit() {
        jars = jars.filter(other => String(other.id) !== String(jar.id));
        saveData();
        renderAll();
        showToast(`${jar.name} has been deleted.`);
      }
    });
  }

  /* -------------------------------------------------------
     14. ADD A WISHLIST FIND
  ------------------------------------------------------- */

  function openAddFindModal() {
    openModal({
      eyebrow: "SOMETHING TO LOOK FORWARD TO",
      title: "Add a little wish.",
      description: "Keep the things you want in one place, then save towards them.",
      submitText: "Add to finds",
      fields: [
        {
          label: "What are you saving for?",
          name: "name",
          placeholder: "e.g. A new matcha set",
          required: true
        },
        {
          label: "Price (£)",
          name: "price",
          type: "number",
          placeholder: "0.00",
          min: "0.01",
          step: "0.01",
          required: true
        },
        {
          label: "Category",
          name: "category",
          type: "select",
          required: true,
          options: CATEGORIES
        },
        {
          label: "Priority",
          name: "priority",
          type: "select",
          required: true,
          options: PRIORITIES
        }
      ],
      onSubmit(data) {
        const name = String(data.get("name") || "").trim();
        const price = Number(data.get("price"));
        const category = String(data.get("category"));
        const priority = String(data.get("priority"));

        if (!name) return showFormError("Give your find a name first."), false;
        if (name.length > 100) return showFormError("Keep the name under 100 characters."), false;
        if (!Number.isFinite(price) || Math.round(price * 100) <= 0) {
          return showFormError("Enter a price greater than £0."), false;
        }
        if (!CATEGORIES.includes(category) || !PRIORITIES.includes(priority)) {
          return showFormError("Choose a category and priority from the lists."), false;
        }

        finds.unshift({
          id: makeId("find"),
          name,
          price: normaliseMoney(price),
          category,
          priority,
          saved: 0
        });

        saveData();
        renderAll();
        showToast(`${name} has been added to your finds.`);
      }
    });
  }

  /* -------------------------------------------------------
     15. FUND A WISHLIST FIND FROM A JAR
  ------------------------------------------------------- */

  function openFundFindModal(findId) {
    const item = findFind(findId);
    if (!item) return;

    const remaining = remainingForFind(item);
    if (remaining <= 0) {
      showToast("This find is already fully funded.");
      return;
    }

    const availableJars = jars.filter(jar => toCents(jar.balance) > 0);

    if (availableJars.length === 0) {
      showToast("Add money to a jar before you fund a find.", "error");
      return;
    }

    openModal({
      eyebrow: "A LITTLE CLOSER",
      title: "Fund your find.",
      description: `${item.name} has ${formatMoney(item.saved)} saved, with ${formatMoney(remaining)} left to go.`,
      submitText: "Move savings",
      fields: [
        {
          label: "Take the money from",
          name: "jarId",
          type: "select",
          required: true,
          options: availableJars.map(jar => ({
            value: String(jar.id),
            label: `${jar.icon} ${jar.name} · ${formatMoney(jar.balance)}`
          }))
        },
        {
          label: "Amount (£)",
          name: "amount",
          type: "number",
          placeholder: "0.00",
          min: "0.01",
          max: remaining,
          step: "0.01",
          required: true,
          hint: `No more than ${formatMoney(remaining)} is needed for this find.`
        }
      ],
      onSubmit(data) {
        const jar = findJar(data.get("jarId"));
        const amount = Number(data.get("amount"));
        const amountCents = Math.round(amount * 100);

        if (!jar) return showFormError("Choose a valid jar."), false;
        if (!Number.isFinite(amount) || amountCents <= 0) {
          return showFormError("Enter an amount greater than £0."), false;
        }
        if (amountCents > toCents(jar.balance)) {
          return showFormError(`This jar only has ${formatMoney(jar.balance)}.`), false;
        }
        if (amountCents > toCents(remaining)) {
          return showFormError(`Only ${formatMoney(remaining)} is needed for this find.`), false;
        }

        jar.balance = fromCents(toCents(jar.balance) - amountCents);
        item.saved = fromCents(toCents(item.saved) + amountCents);

        saveData();
        renderAll();
        showToast(`${formatMoney(amount)} moved towards ${item.name}.`);
      }
    });
  }

  /* -------------------------------------------------------
     16. DELETE A FIND
  ------------------------------------------------------- */

  function openDeleteFindModal(findId) {
    const item = findFind(findId);
    if (!item) return;

    const description = item.saved > 0
      ? `${item.name} has ${formatMoney(item.saved)} recorded as saved. Deleting it won't automatically return that money to a jar.`
      : `Remove ${item.name} from your wishlist? This can't be undone.`;

    openModal({
      eyebrow: "A LITTLE HOUSEKEEPING",
      title: "Remove this find?",
      description,
      submitText: "Remove find",
      fields: [],
      onSubmit() {
        finds = finds.filter(find => String(find.id) !== String(item.id));
        saveData();
        renderAll();
        showToast(`${item.name} has been removed from your finds.`);
      }
    });
  }

  /* -------------------------------------------------------
     17. FILTERS & BUTTON ACTIONS
  ------------------------------------------------------- */

  const filters = $("#finds-filters");

  if (filters) {
    filters.addEventListener("click", event => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;

      activeFilter = button.dataset.filter;
      renderFinds();
    });
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    switch (action) {
      case "add-money":
        openMoneyModal(id, "add");
        break;
      case "remove-money":
        openMoneyModal(id, "remove");
        break;
      case "edit-goal":
        openGoalModal(id);
        break;
      case "delete-jar":
        openDeleteJarModal(id);
        break;
      case "fund-find":
        openFundFindModal(id);
        break;
      case "delete-find":
        openDeleteFindModal(id);
        break;
    }
  });

  const addJarButton = $("#add-jar-button");
  if (addJarButton) addJarButton.addEventListener("click", openAddJarModal);

  const addFindButton = $("#add-find-button");
  if (addFindButton) addFindButton.addEventListener("click", openAddFindModal);

  /* -------------------------------------------------------
     18. INITIALISE
  ------------------------------------------------------- */

  renderAll();
  showPage("overview");

  if (storedJars.invalid || storedFinds.invalid) {
    showToast(
      "Some saved data couldn't be read. Your app has opened with safe defaults.",
      "error"
    );
  }

  console.log("🍒 Funding the Future is ready.");
})();
