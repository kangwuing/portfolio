const STORAGE_KEY = "toeic-reading-lab-v1";
const QUIZ_SIZE = 50;
const STATUS_LABELS = {
  new: "Chưa học",
  learning: "Đang học",
  mastered: "Đã thuộc",
};
const VIEW_TITLES = {
  dashboard: "Tổng quan học tập",
  vocabulary: "Thư viện từ vựng",
  grammar: "Thư viện ngữ pháp",
  flashcards: "Flashcards",
  quiz: "Kiểm tra 50 câu",
};

const state = {
  data: null,
  allItems: [],
  progress: {},
  currentView: "dashboard",
  libraryType: "vocabulary",
  visibleGroupLimit: 6,
  flashDeck: [],
  flashIndex: 0,
  quiz: null,
  streak: 1,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.progress = saved.progress || {};
    const today = new Date();
    const todayKey = dateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (saved.lastStudyDate === todayKey) {
      state.streak = saved.streak || 1;
    } else if (saved.lastStudyDate === dateKey(yesterday)) {
      state.streak = (saved.streak || 0) + 1;
    } else {
      state.streak = 1;
    }
    saveLocalState({ lastStudyDate: todayKey });
  } catch {
    state.progress = {};
    state.streak = 1;
  }
}

function saveLocalState(extra = {}) {
  const previous = (() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  })();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...previous,
      ...extra,
      progress: state.progress,
      streak: state.streak,
    }),
  );
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusOf(id) {
  return state.progress[id] || "new";
}

function setStatus(id, status, notify = true) {
  if (!id || !STATUS_LABELS[status]) return;
  if (status === "new") delete state.progress[id];
  else state.progress[id] = status;
  saveLocalState();
  updateProgressUI();
  if (notify) showToast(`Đã chuyển sang “${STATUS_LABELS[status]}”.`);
}

function priorityClass(priority) {
  if (priority === "Rất cao") return "highest";
  if (priority === "Cao") return "high";
  if (priority === "Trung bình") return "medium";
  return "standard";
}

function itemForQuickEntry(entry) {
  const quick = normalize(entry.term);
  const candidates = state.allItems.filter(
    (item) => item.test === entry.test && item.type === entry.type,
  );
  return (
    candidates.find((item) => normalize(item.term) === quick) ||
    candidates.find((item) => {
      const term = normalize(item.term);
      return term.length > 4 && (quick.includes(term) || term.includes(quick));
    }) ||
    null
  );
}

function progressSummary() {
  const total = state.allItems.length;
  const mastered = state.allItems.filter((item) => statusOf(item.id) === "mastered").length;
  const learning = state.allItems.filter((item) => statusOf(item.id) === "learning").length;
  return {
    total,
    mastered,
    learning,
    newCount: total - mastered - learning,
    percent: total ? Math.round((mastered / total) * 100) : 0,
  };
}

function updateProgressUI() {
  if (!state.data) return;
  const summary = progressSummary();
  $("#sidebarRing").style.setProperty("--progress", summary.percent);
  $("#heroRing").style.setProperty("--progress", summary.percent);
  $("#sidebarPercent").textContent = `${summary.percent}%`;
  $("#heroPercent").textContent = `${summary.percent}%`;
  $("#sidebarMastered").textContent = `${summary.mastered} / ${summary.total} đã thuộc`;
  $("#heroRemaining").textContent = summary.total - summary.mastered;
  $("#streakCount").textContent = state.streak;
  renderStats(summary);
}

function renderStats(summary) {
  const latestQuiz = (() => {
    try {
      const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").quizHistory || [];
      const latest = history.at(-1);
      return latest ? { score: latest.score, total: latest.total || 10 } : null;
    } catch {
      return null;
    }
  })();
  const cards = [
    ["TV", state.data.vocabulary.length, "Từ / cụm B1–C1"],
    ["NP", state.data.grammar.length, "Cấu trúc ngữ pháp"],
    ["ĐH", summary.mastered, "Mục đã thuộc"],
    ["QZ", latestQuiz == null ? "—" : `${latestQuiz.score}/${latestQuiz.total}`, "Điểm quiz gần nhất"],
  ];
  $("#statsGrid").innerHTML = cards
    .map(
      ([icon, value, label]) => `
        <article class="stat-card">
          <span class="stat-icon">${icon}</span>
          <div><strong>${value}</strong><small>${label}</small></div>
        </article>`,
    )
    .join("");
}

function renderPriorityList() {
  const testOne = state.data.quickReview.filter((entry) => entry.test === 1).slice(0, 4);
  const testTwo = state.data.quickReview.filter((entry) => entry.test === 2).slice(0, 4);
  const entries = testOne.flatMap((entry, index) => [entry, testTwo[index]]).filter(Boolean);
  $("#priorityList").innerHTML = entries
    .map((entry, index) => {
      const item = itemForQuickEntry(entry);
      const status = item ? statusOf(item.id) : "new";
      return `
        <article class="priority-item">
          <span class="number">${String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>${escapeHtml(entry.term)}</strong>
            <small>${escapeHtml(entry.meaning)}</small>
          </div>
          <span class="test-tag">T${entry.test}${status === "mastered" ? " · ✓" : ""}</span>
        </article>`;
    })
    .join("");
}

function setView(view, options = {}) {
  if (!VIEW_TITLES[view]) view = "dashboard";
  state.currentView = view;
  $("#viewTitle").textContent = VIEW_TITLES[view];
  $$(".nav-item[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  $$(".view").forEach((panel) => panel.classList.remove("is-active"));

  if (view === "vocabulary" || view === "grammar") {
    $("#libraryView").classList.add("is-active");
    setLibraryType(view);
  } else {
    $(`#${view}View`)?.classList.add("is-active");
  }

  if (view === "flashcards") {
    if (options.priorityOnly) $("#flashPriority").checked = true;
    buildFlashDeck();
  }
  if (view === "quiz") resetQuizView();
  history.replaceState(null, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLibraryType(type) {
  state.libraryType = type;
  state.visibleGroupLimit = 6;
  $$(".library-tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.library === type));
  renderLibrary();
}

function currentFilters() {
  return {
    search: $("#searchInput").value.trim().toLowerCase(),
    test: $("#testFilter").value,
    part: $("#partFilter").value,
    cefr: $("#cefrFilter").value,
    priority: $("#priorityFilter").value,
    status: $("#statusFilter").value,
  };
}

function filteredLibraryItems() {
  const filters = currentFilters();
  const source = state.libraryType === "vocabulary" ? state.data.vocabulary : state.data.grammar;
  return source.filter((item) => {
    const haystack = [
      item.term,
      item.meaning,
      item.group,
      item.synonyms,
      item.example,
      item.wordFamily,
      item.trap,
      item.source,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!filters.search || haystack.includes(filters.search)) &&
      (filters.test === "all" || item.test === Number(filters.test)) &&
      (filters.part === "all" || item.parts.includes(filters.part)) &&
      (filters.cefr === "all" || item.cefr === filters.cefr) &&
      (filters.priority === "all" || item.priority === filters.priority) &&
      (filters.status === "all" || statusOf(item.id) === filters.status)
    );
  });
}

function renderLibrary() {
  const items = filteredLibraryItems();
  $("#resultCount").textContent = items.length;
  const grouped = new Map();
  items.forEach((item) => {
    const key = `${item.test}-${item.groupCode}-${item.group}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });
  const groups = [...grouped.values()];
  const visibleGroups = groups.slice(0, state.visibleGroupLimit);
  $("#libraryGroups").innerHTML = visibleGroups.length
    ? visibleGroups.map(renderGroup).join("")
    : `<div class="empty-state"><strong>Không tìm thấy mục phù hợp.</strong><p>Hãy thử xóa bớt bộ lọc hoặc dùng từ khóa khác.</p></div>`;
  $("#loadMoreButton").hidden = groups.length <= state.visibleGroupLimit;
}

function renderGroup(items) {
  const first = items[0];
  const typeLabel = state.libraryType === "vocabulary" ? "từ / cụm" : "cấu trúc";
  const rows = items.map(state.libraryType === "vocabulary" ? renderVocabularyRow : renderGrammarRow).join("");
  return `
    <section class="group-card">
      <header class="group-header">
        <span class="group-code">${escapeHtml(first.groupCode)}</span>
        <div><h3>${escapeHtml(first.group)}</h3><p>Test ${first.test} · Nhóm đồng nghĩa / cùng chức năng</p></div>
        <span>${items.length} ${typeLabel}</span>
      </header>
      <table class="item-table">
        <thead>${state.libraryType === "vocabulary" ? vocabularyHeader() : grammarHeader()}</thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

function vocabularyHeader() {
  return `<tr><th style="width:20%">Từ / cụm</th><th style="width:18%">Nghĩa</th><th style="width:22%">Đồng nghĩa</th><th>Ví dụ / collocation</th><th style="width:11%">Ưu tiên</th><th style="width:12%">Tiến độ</th></tr>`;
}

function grammarHeader() {
  return `<tr><th style="width:23%">Cấu trúc</th><th style="width:18%">Nghĩa</th><th>Bẫy / khác biệt</th><th style="width:15%">Nguồn</th><th style="width:11%">Ưu tiên</th><th style="width:12%">Tiến độ</th></tr>`;
}

function renderVocabularyRow(item) {
  return `
    <tr>
      <td class="term-cell"><strong>${escapeHtml(item.term)}</strong><small>${escapeHtml(item.wordType)} · ${escapeHtml(item.source)}</small></td>
      <td>${escapeHtml(item.meaning)}</td>
      <td class="muted-cell">${escapeHtml(item.synonyms || "—")}</td>
      <td class="muted-cell">${escapeHtml(item.example || item.wordFamily || "—")}</td>
      ${renderSharedCells(item)}
    </tr>`;
}

function renderGrammarRow(item) {
  return `
    <tr>
      <td class="term-cell"><strong>${escapeHtml(item.term)}</strong><small>${escapeHtml(item.cefr)} · Part ${item.parts.join(", ")}</small></td>
      <td>${escapeHtml(item.meaning)}</td>
      <td class="muted-cell">${escapeHtml(item.trap || "—")}</td>
      <td class="muted-cell">${escapeHtml(item.source)}</td>
      ${renderSharedCells(item)}
    </tr>`;
}

function renderSharedCells(item) {
  const status = statusOf(item.id);
  return `
    <td class="priority-cell"><div class="meta-stack"><span class="priority-badge ${priorityClass(item.priority)}">${escapeHtml(item.priority)}</span><span class="meta-tag">${escapeHtml(item.cefr)}</span></div></td>
    <td>
      <select class="status-control" data-item-id="${item.id}" data-status="${status}" aria-label="Trạng thái của ${escapeHtml(item.term)}">
        <option value="new" ${status === "new" ? "selected" : ""}>Chưa học</option>
        <option value="learning" ${status === "learning" ? "selected" : ""}>Đang học</option>
        <option value="mastered" ${status === "mastered" ? "selected" : ""}>Đã thuộc</option>
      </select>
    </td>`;
}

function clearFilters() {
  $("#filterForm").reset();
  state.visibleGroupLimit = 6;
  renderLibrary();
}

function buildFlashDeck({ shuffleDeck = false } = {}) {
  const type = $("#flashType").value;
  const test = $("#flashTest").value;
  const priorityOnly = $("#flashPriority").checked;
  let deck = state.allItems.filter(
    (item) =>
      (type === "all" || item.type === type) &&
      (test === "all" || item.test === Number(test)) &&
      (!priorityOnly || ["Rất cao", "Cao"].includes(item.priority)),
  );
  deck.sort((a, b) => {
    const statusOrder = { learning: 0, new: 1, mastered: 2 };
    return statusOrder[statusOf(a.id)] - statusOrder[statusOf(b.id)];
  });
  state.flashDeck = shuffleDeck ? shuffle(deck) : deck;
  state.flashIndex = 0;
  renderFlashcard();
}

function renderFlashcard() {
  const card = state.flashDeck[state.flashIndex];
  $("#flashcard").classList.remove("is-flipped");
  if (!card) {
    $("#flashCounter").textContent = "0 / 0";
    $("#flashTerm").textContent = "Không có thẻ phù hợp";
    $("#flashMeaning").textContent = "Hãy đổi bộ lọc flashcards.";
    $("#flashMeta").innerHTML = "";
    $("#flashBackMeta").innerHTML = "";
    $("#flashProgressBar").style.width = "0%";
    return;
  }
  const meta = `
    <span class="test-tag">Test ${card.test}</span>
    <span class="meta-tag">${card.type === "vocabulary" ? "Từ vựng" : "Ngữ pháp"}</span>
    <span class="meta-tag">${escapeHtml(card.cefr)}</span>
    <span class="priority-badge ${priorityClass(card.priority)}">${escapeHtml(card.priority)}</span>`;
  $("#flashMeta").innerHTML = meta;
  $("#flashBackMeta").innerHTML = meta;
  $("#flashTerm").textContent = card.term;
  $("#flashMeaning").textContent = card.meaning;
  $("#flashDetail").textContent =
    card.type === "vocabulary"
      ? [card.synonyms && `Gần nghĩa: ${card.synonyms}`, card.example && `Cách dùng: ${card.example}`].filter(Boolean).join(" · ")
      : card.trap || "Ghi nhớ cấu trúc và loại từ đi sau.";
  $("#flashSource").textContent = `${card.source} · ${card.group}`;
  $("#flashCounter").textContent = `${state.flashIndex + 1} / ${state.flashDeck.length}`;
  $("#flashProgressBar").style.width = `${((state.flashIndex + 1) / state.flashDeck.length) * 100}%`;
}

function moveFlashcard(step) {
  if (!state.flashDeck.length) return;
  state.flashIndex = (state.flashIndex + step + state.flashDeck.length) % state.flashDeck.length;
  renderFlashcard();
}

function recallCurrent(status) {
  const card = state.flashDeck[state.flashIndex];
  if (!card) return;
  setStatus(card.id, status, false);
  showToast(`${card.term}: ${STATUS_LABELS[status]}.`);
  moveFlashcard(1);
}

function resetQuizView() {
  $("#quizSetup").hidden = false;
  $("#quizQuestion").hidden = true;
  $("#quizResult").hidden = true;
  state.quiz = null;
}

function startQuiz() {
  const type = $("#quizType").value;
  const test = $("#quizTest").value;
  const weakOnly = $("#quizWeakOnly").checked;
  const preferredPool = state.allItems.filter(
    (item) =>
      (type === "mixed" || item.type === type) &&
      (test === "all" || item.test === Number(test)) &&
      (!weakOnly || statusOf(item.id) !== "mastered"),
  );
  const tiers = [
    preferredPool,
    state.allItems.filter(
      (item) =>
        (type === "mixed" || item.type === type) &&
        (test === "all" || item.test === Number(test)),
    ),
    state.allItems.filter((item) => type === "mixed" || item.type === type),
  ];
  const pool = [];
  const includedIds = new Set();
  tiers.forEach((tier) => {
    shuffle(tier).forEach((item) => {
      if (pool.length < QUIZ_SIZE && !includedIds.has(item.id)) {
        pool.push(item);
        includedIds.add(item.id);
      }
    });
  });
  const questions = pool.map((item) => buildQuestion(item, pool));
  state.quiz = { questions, index: 0, score: 0, answered: false };
  $("#quizSetup").hidden = true;
  $("#quizQuestion").hidden = false;
  $("#quizResult").hidden = true;
  renderQuestion();
  if (preferredPool.length < QUIZ_SIZE) {
    showToast(`Bộ lọc có ${preferredPool.length} mục; đã bổ sung cùng loại để đủ ${questions.length} câu.`);
  }
}

function buildQuestion(item, pool) {
  const alternatives = shuffle(
    pool.filter((candidate) => candidate.id !== item.id && candidate.type === item.type && candidate.meaning !== item.meaning),
  )
    .map((candidate) => candidate.meaning)
    .filter((meaning, index, array) => meaning && array.indexOf(meaning) === index)
    .slice(0, 3);
  if (alternatives.length < 3) {
    const fallback = shuffle(
      state.allItems.filter((candidate) => candidate.id !== item.id && candidate.meaning !== item.meaning),
    );
    fallback.forEach((candidate) => {
      if (alternatives.length < 3 && !alternatives.includes(candidate.meaning)) alternatives.push(candidate.meaning);
    });
  }
  return { item, options: shuffle([item.meaning, ...alternatives.slice(0, 3)]) };
}

function renderQuestion() {
  const quiz = state.quiz;
  const question = quiz.questions[quiz.index];
  quiz.answered = false;
  $("#quizCounter").textContent = `Câu ${quiz.index + 1} / ${quiz.questions.length}`;
  $("#quizScore").textContent = quiz.score;
  $("#quizProgress").style.width = `${(quiz.index / quiz.questions.length) * 100}%`;
  $("#questionLabel").textContent = question.item.type === "vocabulary" ? "CHỌN NGHĨA ĐÚNG" : "CẤU TRÚC NÀY CÓ NGHĨA GÌ?";
  $("#questionTerm").textContent = question.item.term;
  $("#answerFeedback").textContent = "";
  $("#nextQuestion").hidden = true;
  const letters = ["A", "B", "C", "D"];
  $("#answerOptions").innerHTML = question.options
    .map(
      (option, index) => `
        <button class="answer-option" type="button" data-answer-index="${index}">
          <span>${letters[index]}</span><span>${escapeHtml(option)}</span>
        </button>`,
    )
    .join("");
}

function answerQuestion(optionIndex) {
  const quiz = state.quiz;
  if (!quiz || quiz.answered) return;
  quiz.answered = true;
  const question = quiz.questions[quiz.index];
  const selected = question.options[optionIndex];
  const correct = selected === question.item.meaning;
  if (correct) quiz.score += 1;
  if (statusOf(question.item.id) !== "mastered") setStatus(question.item.id, "learning", false);
  $$(".answer-option").forEach((button, index) => {
    button.disabled = true;
    const value = question.options[index];
    if (value === question.item.meaning) button.classList.add("is-correct");
    else if (index === optionIndex) button.classList.add("is-wrong");
  });
  $("#quizScore").textContent = quiz.score;
  $("#answerFeedback").innerHTML = correct
    ? `<strong>Chính xác.</strong> ${escapeHtml(question.item.source)}`
    : `<strong>Chưa đúng.</strong> Đáp án: ${escapeHtml(question.item.meaning)} · ${escapeHtml(question.item.source)}`;
  $("#nextQuestion").textContent = quiz.index === quiz.questions.length - 1 ? "Xem kết quả" : "Câu tiếp theo";
  $("#nextQuestion").hidden = false;
}

function advanceQuiz() {
  const quiz = state.quiz;
  if (!quiz?.answered) return;
  if (quiz.index < quiz.questions.length - 1) {
    quiz.index += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const quiz = state.quiz;
  const score = quiz.score;
  const accuracy = quiz.questions.length ? score / quiz.questions.length : 0;
  $("#quizQuestion").hidden = true;
  $("#quizResult").hidden = false;
  $("#resultScore").textContent = `${score}/${quiz.questions.length}`;
  $("#resultTitle").textContent = accuracy >= 0.9 ? "Rất chắc kiến thức." : accuracy >= 0.7 ? "Một bước tiến tốt." : "Đã tìm ra phần cần ôn.";
  $("#resultMessage").textContent =
    accuracy >= 0.9
      ? "Bạn có thể chuyển các mục còn phân vân sang flashcards để củng cố lần cuối."
      : accuracy >= 0.7
        ? "Hãy ôn lại những câu vừa sai rồi thử một lượt mới."
        : "Nên quay lại nhóm từ và cấu trúc ưu tiên trước khi làm lại quiz.";
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  const quizHistory = [...(saved.quizHistory || []), { date: dateKey(new Date()), score, total: quiz.questions.length }].slice(-20);
  saveLocalState({ quizHistory });
  updateProgressUI();
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function bindEvents() {
  $$(".nav-item[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$('[data-jump]').forEach((button) =>
    button.addEventListener("click", () =>
      setView(button.dataset.jump, { priorityOnly: button.dataset.priorityOnly === "true" }),
    ),
  );
  $$(".library-tab").forEach((tab) => tab.addEventListener("click", () => setView(tab.dataset.library)));
  $("#filterForm").addEventListener("input", () => {
    state.visibleGroupLimit = 6;
    renderLibrary();
  });
  $("#clearFilters").addEventListener("click", clearFilters);
  $("#loadMoreButton").addEventListener("click", () => {
    state.visibleGroupLimit += 6;
    renderLibrary();
  });
  $("#libraryGroups").addEventListener("change", (event) => {
    const select = event.target.closest(".status-control");
    if (!select) return;
    select.dataset.status = select.value;
    setStatus(select.dataset.itemId, select.value);
    if ($("#statusFilter").value !== "all") renderLibrary();
  });

  ["#flashType", "#flashTest", "#flashPriority"].forEach((selector) => $(selector).addEventListener("change", () => buildFlashDeck()));
  $("#shuffleCards").addEventListener("click", () => buildFlashDeck({ shuffleDeck: true }));
  $("#flashcard").addEventListener("click", () => $("#flashcard").classList.toggle("is-flipped"));
  $("#previousCard").addEventListener("click", () => moveFlashcard(-1));
  $("#nextCard").addEventListener("click", () => moveFlashcard(1));
  $$("[data-recall]").forEach((button) => button.addEventListener("click", () => recallCurrent(button.dataset.recall)));

  $("#startQuiz").addEventListener("click", startQuiz);
  $("#answerOptions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-answer-index]");
    if (button) answerQuestion(Number(button.dataset.answerIndex));
  });
  $("#nextQuestion").addEventListener("click", advanceQuiz);
  $("#retryQuiz").addEventListener("click", resetQuizView);

  $("#resetButton").addEventListener("click", () => $("#resetDialog").showModal());
  $("#confirmReset").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state.progress = {};
    state.streak = 1;
    updateProgressUI();
    renderPriorityList();
    if (["vocabulary", "grammar"].includes(state.currentView)) renderLibrary();
    showToast("Đã đặt lại tiến độ trên thiết bị này.");
  });

  document.addEventListener("keydown", (event) => {
    if (state.currentView !== "flashcards" || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
    if (event.key === "ArrowLeft") moveFlashcard(-1);
    if (event.key === "ArrowRight") moveFlashcard(1);
    if (event.key === " ") {
      event.preventDefault();
      $("#flashcard").classList.toggle("is-flipped");
    }
    if (["1", "2", "3"].includes(event.key)) recallCurrent(["new", "learning", "mastered"][Number(event.key) - 1]);
  });

  window.addEventListener("hashchange", () => {
    const view = location.hash.replace("#", "");
    if (VIEW_TITLES[view] && view !== state.currentView) setView(view);
  });
}

async function init() {
  loadLocalState();
  const response = await fetch("./data/study-data.json");
  if (!response.ok) throw new Error(`Không tải được dữ liệu (${response.status})`);
  state.data = await response.json();
  state.allItems = [...state.data.vocabulary, ...state.data.grammar];

  const now = new Date();
  $("#todayLabel").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);
  $("#cefrNotice").textContent = state.data.meta.cefrNotice;
  renderPriorityList();
  updateProgressUI();
  bindEvents();
  buildFlashDeck();

  const initialView = location.hash.replace("#", "");
  setView(VIEW_TITLES[initialView] ? initialView : "dashboard");
  $("#loadingScreen").remove();
  $("#app").hidden = false;
}

init().catch((error) => {
  $("#loadingScreen").innerHTML = `<div class="loading-mark">!</div><strong>Không thể mở ứng dụng</strong><p>${escapeHtml(error.message)}</p>`;
  console.error(error);
});
