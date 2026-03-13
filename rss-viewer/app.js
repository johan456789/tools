const elements = {
  form: document.getElementById("feed-form"),
  feedUrlInput: document.getElementById("feed-url"),
  proxyUrlInput: document.getElementById("proxy-url"),
  rememberProxyInput: document.getElementById("remember-proxy"),
  loadButton: document.getElementById("load-button"),
  statusMessage: document.getElementById("status-message"),
  feedSummary: document.getElementById("feed-summary"),
  feedMetaLabel: document.getElementById("feed-meta-label"),
  feedTitle: document.getElementById("feed-title"),
  feedDescription: document.getElementById("feed-description"),
  articlesGrid: document.getElementById("articles-grid"),
  modal: document.getElementById("article-modal"),
  modalCard: document.getElementById("modal-card"),
  modalHeader: document.getElementById("modal-header"),
  modalTitle: document.getElementById("modal-title"),
  modalDate: document.getElementById("modal-date"),
  modalViewMode: document.getElementById("modal-view-mode"),
  modalBody: document.getElementById("modal-body"),
  closeModalButton: document.getElementById("close-modal-button"),
};

const articleCache = new Map();
const feedCache = new Map();
let currentArticles = [];
let currentModalArticle = null;
let lastFocusedCard = null;

const parser = new DOMParser();
const serializer = new XMLSerializer();
const excerptLength = 220;
const fetchAttemptTimeoutMs = 5000;
const defaultDocumentTitle = "RSS Viewer";
const rememberedProxyUrlStorageKey = "tools:rss-viewer:proxy-url";

elements.form.addEventListener("submit", handleSubmit);
elements.closeModalButton.addEventListener("click", closeModal);
elements.rememberProxyInput.addEventListener("change", syncRememberedProxyPreference);
elements.modalViewMode.addEventListener("change", () => {
  renderModalBody();
});
elements.modal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.dataset.closeModal) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.modal.hidden) {
    closeModal();
  }
});

window.addEventListener("popstate", () => {
  const previousFeed = elements.feedUrlInput.value;
  syncInputFromUrl();
  if (elements.feedUrlInput.value && elements.feedUrlInput.value !== previousFeed) {
    if (!elements.proxyUrlInput.value.trim()) {
      setStatus("CORS header proxy URL is a required field.", "error");
      resetFeedView();
      updateDocumentTitle(elements.feedUrlInput.value);
      return;
    }
    loadFeed(elements.feedUrlInput.value, elements.proxyUrlInput.value);
    return;
  }

  if (!elements.feedUrlInput.value) {
    resetFeedView();
  }

  updateDocumentTitle(elements.feedUrlInput.value);
});

restoreRememberedProxy();
syncInputFromUrl();
updateDocumentTitle(elements.feedUrlInput.value);
if (elements.feedUrlInput.value && elements.proxyUrlInput.value.trim()) {
  loadFeed(elements.feedUrlInput.value, elements.proxyUrlInput.value);
} else if (elements.feedUrlInput.value) {
  setStatus("CORS header proxy URL is a required field.", "error");
  resetFeedView();
} else {
  resetFeedView();
}

async function handleSubmit(event) {
  event.preventDefault();
  const feedUrl = elements.feedUrlInput.value.trim();
  const proxyUrl = elements.proxyUrlInput.value.trim();
  if (!feedUrl) {
    setStatus("Feed URL is a required field.", "error");
    elements.feedUrlInput.focus();
    return;
  }

  if (!proxyUrl) {
    setStatus("CORS header proxy URL is a required field.", "error");
    elements.proxyUrlInput.focus();
    return;
  }

  syncRememberedProxyPreference();
  updateUrl(feedUrl);
  await loadFeed(feedUrl, proxyUrl);
}

function syncInputFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const feed = params.get("feed") || "";
  elements.feedUrlInput.value = feed;
}

function updateUrl(feedUrl) {
  const nextUrl = new URL(window.location.href);
  if (feedUrl) {
    nextUrl.searchParams.set("feed", feedUrl);
  } else {
    nextUrl.searchParams.delete("feed");
  }
  if (nextUrl.toString() === window.location.href) {
    return;
  }
  window.history.pushState({}, "", nextUrl);
}

function restoreRememberedProxy() {
  const rememberedProxyUrl = localStorage.getItem(rememberedProxyUrlStorageKey);
  if (!rememberedProxyUrl) {
    return;
  }

  elements.proxyUrlInput.value = rememberedProxyUrl;
  elements.rememberProxyInput.checked = true;
}

function syncRememberedProxyPreference() {
  if (!elements.rememberProxyInput.checked) {
    localStorage.removeItem(rememberedProxyUrlStorageKey);
    return;
  }

  const proxyUrl = elements.proxyUrlInput.value.trim();
  if (!proxyUrl) {
    localStorage.removeItem(rememberedProxyUrlStorageKey);
    return;
  }

  localStorage.setItem(rememberedProxyUrlStorageKey, proxyUrl);
}

async function loadFeed(feedUrl, proxyUrl) {
  const normalizedFeedUrl = feedUrl.trim();
  const normalizedProxyUrl = proxyUrl.trim();
  const feedCacheKey = `${normalizedProxyUrl}::${normalizedFeedUrl}`;
  articleCache.clear();
  currentArticles = [];
  closeModal();
  clearArticles();
  elements.feedSummary.hidden = true;
  setLoadingState(true);
  setStatus("Loading feed and parsing entries...", "loading");
  updateDocumentTitle(normalizedFeedUrl, "Loading");

  try {
    const cachedFeed = feedCache.get(feedCacheKey);
    if (cachedFeed) {
      renderLoadedFeed(cachedFeed, normalizedFeedUrl);
      return;
    }

    const xmlText = await fetchFeedText(normalizedFeedUrl, normalizedProxyUrl);
    const parsedFeed = parseFeed(xmlText, normalizedFeedUrl);
    feedCache.set(feedCacheKey, parsedFeed);
    renderLoadedFeed(parsedFeed, normalizedFeedUrl);
  } catch (error) {
    console.error(error);
    elements.feedSummary.hidden = true;
    updateDocumentTitle(normalizedFeedUrl, "Error");
    setStatus(error.message || "Failed to load the feed.", "error");
  } finally {
    setLoadingState(false);
  }
}

function renderLoadedFeed(parsedFeed, feedUrl) {
  currentArticles = parsedFeed.items;
  renderFeedSummary(parsedFeed);
  renderArticles(parsedFeed.items);

  if (parsedFeed.items.length === 0) {
    updateDocumentTitle(feedUrl, "Empty");
    setStatus("The feed loaded, but it does not contain any readable items.", "error");
    return;
  }

  updateDocumentTitle(feedUrl, parsedFeed.title);
  setStatus("", "ready");
}

function resetFeedView() {
  articleCache.clear();
  currentArticles = [];
  closeModal();
  clearArticles();
  elements.feedSummary.hidden = true;
  elements.feedMetaLabel.textContent = "Current feed";
  setStatus("", "ready");
}

function updateDocumentTitle(feedUrl, feedLabel = "") {
  const normalizedFeedUrl = (feedUrl || "").trim();
  if (!normalizedFeedUrl) {
    document.title = defaultDocumentTitle;
    return;
  }

  const siteName = getSiteNameFromUrl(normalizedFeedUrl);
  const normalizedLabel = (feedLabel || "").trim();

  if (normalizedLabel) {
    document.title = `${normalizedLabel} - ${defaultDocumentTitle}`;
    return;
  }

  document.title = `${siteName} - ${defaultDocumentTitle}`;
}

function getSiteNameFromUrl(feedUrl) {
  try {
    const url = new URL(feedUrl);
    return url.hostname;
  } catch {
    return feedUrl;
  }
}

async function fetchFeedText(url, proxyUrl) {
  return fetchTextWithProxy(url, proxyUrl);
}

async function fetchTextWithProxy(url, proxyUrl) {
  try {
    const response = await fetchWithTimeout(
      buildProxyRequestUrl(proxyUrl, url),
      {
        headers: {
          Accept:
            "application/atom+xml, application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`proxy request failed with ${response.status}`);
    }

    const text = await response.text();
    if (!text || !text.trim()) {
      throw new Error("proxy returned empty content");
    }

    return text;
  } catch (error) {
    throw new Error(`Could not fetch this URL through the configured proxy. ${summarizeAttemptError(error)}`);
  }
}

function buildProxyRequestUrl(proxyUrl, targetUrl) {
  const encodedTargetUrl = encodeURIComponent(targetUrl);
  const normalizedProxyUrl = normalizeProxyBaseUrl(proxyUrl);
  const baseUrl = new URL(normalizedProxyUrl);
  const normalizedPath = baseUrl.pathname.replace(/\/+$/, "");
  baseUrl.pathname = `${normalizedPath}/corsproxy/`;
  baseUrl.search = `?apiurl=${encodedTargetUrl}`;
  return baseUrl.toString();
}

function normalizeProxyBaseUrl(proxyUrl) {
  const trimmedProxyUrl = proxyUrl.trim();
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmedProxyUrl)) {
    return trimmedProxyUrl;
  }

  return `https://${trimmedProxyUrl}`;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), fetchAttemptTimeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`timed out after ${Math.floor(fetchAttemptTimeoutMs / 1000)}s`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function parseFeed(xmlText, sourceUrl) {
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("The response is not valid RSS or Atom XML.");
  }

  const rssChannel = findFirstNode(xmlDoc, "channel");
  if (rssChannel) {
    return parseRssFeed(xmlDoc, sourceUrl);
  }

  const atomFeed = findFirstNode(xmlDoc, "feed");
  if (atomFeed) {
    return parseAtomFeed(xmlDoc, sourceUrl);
  }

  throw new Error("This URL did not look like an RSS or Atom feed.");
}

function parseRssFeed(xmlDoc, sourceUrl) {
  const channel = findFirstNode(xmlDoc, "channel");
  const items = getChildrenByName(channel, "item").map((item, index) =>
    normalizeArticle(
      {
        id:
          getDirectChildText(item, "guid") ||
          getDirectChildText(item, "link") ||
          getNodeText(item, "title") ||
          `${sourceUrl}#${index}`,
        title: getNodeText(item, "title") || "Untitled article",
        link: getDirectChildText(item, "link"),
        date: getNodeText(item, ["pubDate", "date", "published"]),
        summary:
          getNodeMarkup(item, ["description", "encoded", "content"]) ||
          getNodeText(item, ["description", "encoded", "content"]),
        content:
          getNodeMarkup(item, ["encoded", "content", "description"]) ||
          getNodeText(item, ["encoded", "content", "description"]),
        rawXml: serializer.serializeToString(item),
      },
      index
    )
  );

  return {
    title: getNodeText(channel, "title") || "Untitled RSS feed",
    description: clipText(stripHtml(getNodeMarkup(channel, "description") || getNodeText(channel, "description")), 300),
    items,
  };
}

function parseAtomFeed(xmlDoc, sourceUrl) {
  const feed = findFirstNode(xmlDoc, "feed");
  const items = getChildrenByName(feed, "entry").map((entry, index) => {
    const linkNode =
      getChildrenByName(entry, "link").find((node) => {
        const rel = node.getAttribute("rel");
        return !rel || rel === "alternate";
      }) || getChildrenByName(entry, "link")[0];

    return normalizeArticle(
      {
        id: getNodeText(entry, "id") || linkNode?.getAttribute("href") || `${sourceUrl}#${index}`,
        title: getNodeText(entry, "title") || "Untitled article",
        link: linkNode?.getAttribute("href") || "",
        date: getNodeText(entry, ["updated", "published"]),
        summary:
          getNodeMarkup(entry, "summary") ||
          getNodeText(entry, "summary"),
        content:
          getNodeMarkup(entry, "content") ||
          getNodeText(entry, "content") ||
          getNodeMarkup(entry, "summary") ||
          getNodeText(entry, "summary"),
        rawXml: serializer.serializeToString(entry),
      },
      index
    );
  });

  return {
    title: getNodeText(feed, "title") || "Untitled Atom feed",
    description: clipText(stripHtml(getNodeMarkup(feed, "subtitle") || getNodeText(feed, "subtitle")), 300),
    items,
  };
}

function normalizeArticle(article, index) {
  const rawContent = article.content || "";
  const rawSummary = article.summary || "";
  const summaryText = stripHtml(rawSummary);
  const contentText = stripHtml(rawContent);

  return {
    id: article.id || `article-${index}`,
    title: article.title,
    link: article.link,
    date: article.date || "",
    dateLabel: formatDate(article.date),
    excerpt: clipText(summaryText || contentText, excerptLength) || "No excerpt available.",
    contentHtml: rawContent || rawSummary || "",
    contentText,
    rawXml: article.rawXml || "",
  };
}

function findFirstNode(parent, names) {
  const wantedNames = Array.isArray(names) ? names : [names];
  const stack = [parent];

  while (stack.length > 0) {
    const current = stack.shift();
    if (!(current instanceof Element || current instanceof Document)) {
      continue;
    }

    const children = current instanceof Document
      ? Array.from(current.documentElement ? [current.documentElement] : [])
      : Array.from(current.children);

    for (const child of children) {
      if (wantedNames.includes(child.localName)) {
        return child;
      }
      stack.push(child);
    }
  }

  return null;
}

function getChildrenByName(parent, name) {
  if (!parent) {
    return [];
  }

  return Array.from(parent.children).filter((child) => child.localName === name);
}

function getDirectChildText(parent, names) {
  const wantedNames = Array.isArray(names) ? names : [names];
  const node = Array.from(parent?.children || []).find((child) =>
    wantedNames.includes(child.localName)
  );
  return node?.textContent?.trim() || "";
}

function getNodeText(parent, names) {
  const node = findFirstNode(parent, names);
  return node?.textContent?.trim() || "";
}

function getNodeMarkup(parent, names) {
  const node = findFirstNode(parent, names);
  if (!node) {
    return "";
  }

  if (node.childNodes.length === 0) {
    return node.textContent?.trim() || "";
  }

  if (node.children.length > 0) {
    return Array.from(node.childNodes)
      .map((child) => serializer.serializeToString(child))
      .join("")
      .trim();
  }

  return node.textContent?.trim() || "";
}

function renderFeedSummary(feed) {
  const articleCount = feed.items.length;
  elements.feedMetaLabel.textContent = `Current feed (${articleCount} article${
    articleCount === 1 ? "" : "s"
  })`;
  elements.feedTitle.textContent = feed.title;
  elements.feedDescription.textContent = feed.description || "No feed description available.";
  elements.feedSummary.hidden = false;
}

function renderArticles(items) {
  clearArticles();

  const fragment = document.createDocumentFragment();

  for (const article of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "article-card";
    button.dataset.articleId = article.id;

    button.innerHTML = `
      <span class="article-date">${escapeHtml(article.dateLabel || "Date unknown")}</span>
      <h3 class="article-title">${escapeHtml(article.title)}</h3>
      <p class="article-excerpt">${escapeHtml(article.excerpt)}</p>
      <span class="article-footer">Read article</span>
    `;

    button.addEventListener("click", () => {
      lastFocusedCard = button;
      openArticle(article.id);
    });

    fragment.appendChild(button);
  }

  elements.articlesGrid.appendChild(fragment);
}

function clearArticles() {
  elements.articlesGrid.replaceChildren();
}

function setStatus(message, state) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.remove("is-error", "is-loading");
  if (state === "error") {
    elements.statusMessage.classList.add("is-error");
  }
  if (state === "loading") {
    elements.statusMessage.classList.add("is-loading");
  }
}

function setLoadingState(isLoading) {
  elements.loadButton.disabled = isLoading;
  elements.loadButton.textContent = isLoading ? "Loading..." : "Load feed";
}

async function openArticle(articleId) {
  const article = currentArticles.find((entry) => entry.id === articleId);
  if (!article) {
    return;
  }

  currentModalArticle = article;
  elements.modalViewMode.value = "rendered";
  elements.modalTitle.textContent = article.title;
  elements.modalDate.textContent = article.dateLabel || "Date unknown";
  if (article.link) {
    elements.modalTitle.href = article.link;
  } else {
    elements.modalTitle.removeAttribute("href");
  }
  elements.modal.hidden = false;
  document.body.classList.add("modal-open");
  renderModalBody();
}

function closeModal() {
  elements.modal.hidden = true;
  document.body.classList.remove("modal-open");
  currentModalArticle = null;
  if (lastFocusedCard) {
    lastFocusedCard.focus();
  }
}

function renderModalBody() {
  if (!currentModalArticle) {
    elements.modalBody.innerHTML = '<p class="modal-loading">Choose an article to start reading.</p>';
    return;
  }

  const viewMode = elements.modalViewMode.value;
  const content = getArticleContent(currentModalArticle);
  elements.modalCard.classList.toggle("is-source", viewMode === "source");

  if (viewMode === "source") {
    if (!content.sourceXml) {
      elements.modalBody.innerHTML =
        '<p class="modal-fallback">No source content available in this feed item.</p>';
      return;
    }

    elements.modalBody.innerHTML = `<pre class="modal-source-code language-markup"><code class="language-markup">${escapeHtml(
      content.sourceXml
    )}</code></pre>`;
    const codeElement = elements.modalBody.querySelector("code.language-markup");
    if (codeElement && window.Prism?.highlightElement) {
      window.Prism.highlightElement(codeElement);
    }
    return;
  }

  elements.modalBody.innerHTML = content.renderedHtml;
}

function getArticleContent(article) {
  if (articleCache.has(article.id)) {
    return articleCache.get(article.id);
  }

  const sourceText = article.contentHtml || "";
  const sourceXml = article.rawXml ? formatXml(article.rawXml) : "";
  let renderedHtml = sourceText ? sanitizeArticleHtml(sourceText) : "";

  if (!renderedHtml) {
    renderedHtml = '<p class="modal-fallback">No content available in this feed item.</p>';
  }

  const content = {
    renderedHtml,
    sourceText,
    sourceXml,
  };

  articleCache.set(article.id, content);
  return content;
}

function sanitizeArticleHtml(html) {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"],
  });
}

function stripHtml(value) {
  if (!value) {
    return "";
  }

  const doc = parser.parseFromString(`<body>${value}</body>`, "text/html");
  return doc.body.textContent.replace(/\s+/g, " ").trim();
}

function clipText(value, length) {
  if (!value) {
    return "";
  }

  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  const seconds = String(parsed.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function summarizeAttemptError(error) {
  if (!error?.message) {
    return "unknown error";
  }

  if (error.message === "Failed to fetch") {
    return "blocked by CORS, mixed-content, or network policy";
  }

  return error.message;
}

function formatXml(value) {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/>\s*</g, ">\n<").trim();
  const lines = normalized.split("\n");
  const formatted = [];
  let depth = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("</")) {
      depth = Math.max(0, depth - 1);
    }

    formatted.push(`${"  ".repeat(depth)}${line}`);

    if (
      line.startsWith("<") &&
      !line.startsWith("</") &&
      !line.endsWith("/>") &&
      !line.includes("</") &&
      !line.startsWith("<![CDATA[") &&
      !line.startsWith("<?") &&
      !line.startsWith("<!")
    ) {
      depth += 1;
    }
  }

  return formatted.join("\n");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
