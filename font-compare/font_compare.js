class FontComparator {
  constructor() {
    this.fonts = {
      font1: null,
      font2: null,
    };
    this.uploadedFonts = new Map(); // Store uploaded fonts
    this.currentFontSize = 16;
    this.currentLanguage = "plain";
    this.highlighter = null;
    this.init();
  }

  init() {
    // Get DOM elements
    this.elements = {
      sampleText: document.getElementById("sample-text"),
      fontUploadInput: document.getElementById("font-upload-input"),
      font1Select: document.getElementById("font1-select"),
      font2Select: document.getElementById("font2-select"),
      font1Name: document.getElementById("font1-name"),
      font2Name: document.getElementById("font2-name"),
      fontSizeSlider: document.getElementById("font-size"),
      sizeDisplay: document.getElementById("size-display"),
      languageSelect: document.getElementById("language-select"),
      preview1: document.getElementById("preview1"),
      preview2: document.getElementById("preview2"),
      preview1Title: document.getElementById("preview1-title"),
      preview2Title: document.getElementById("preview2-title"),
    };

    this.loadHighlighter();
    this.initTheme();
    this.initializeFallbackFonts();
    this.setDefaultFonts();
    this.initSampleButtons();

    this.bindEvents();
    this.updatePreviews();
  }

  bindEvents() {
    // Text input changes
    this.elements.sampleText.addEventListener("input", () => {
      this.updatePreviews();
    });

    // Font upload
    this.elements.fontUploadInput.addEventListener("change", (e) => {
      this.handleFontUpload(e.target.files);
    });

    // Font selectors
    this.elements.font1Select.addEventListener("change", (e) => {
      this.selectFont(e.target.value, "font1");
    });

    this.elements.font2Select.addEventListener("change", (e) => {
      this.selectFont(e.target.value, "font2");
    });

    // Font size slider
    this.elements.fontSizeSlider.addEventListener("input", (e) => {
      this.currentFontSize = parseInt(e.target.value);
      this.elements.sizeDisplay.textContent = `${this.currentFontSize}px`;
      this.updatePreviews();
    });

    // Language selector
    this.elements.languageSelect.addEventListener("change", (e) => {
      this.currentLanguage = e.target.value;
      this.updatePreviews();
    });

    // Theme toggle button
    document
      .getElementById("theme-toggle-btn")
      .addEventListener("click", () => {
        const currentTheme =
          document.documentElement.getAttribute("data-theme");
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        this.setTheme(newTheme);
      });

    // Load local fonts button
    document
      .getElementById("load-local-fonts-btn")
      .addEventListener("click", () => {
        this.loadLocalFonts();
      });

    // Sample text buttons
    document
      .getElementById("plaintext-sample-btn")
      .addEventListener("click", () => {
        this.setPlaintextSample();
      });

    document.getElementById("code-sample-btn").addEventListener("click", () => {
      this.setCodeSample();
    });

    // Drag and drop for font upload
    this.setupDragAndDrop();
  }

  async loadHighlighter() {
    try {
      // Import Speed Highlight functions
      const module = await import(
        "https://unpkg.com/@speed-highlight/core/dist/index.js"
      );
      this.highlighter = {
        highlightElement: module.highlightElement,
        highlightAll: module.highlightAll,
      };
    } catch (error) {
      console.error("Failed to load syntax highlighter:", error);
      this.highlighter = null;
    }
  }

  initTheme() {
    // Theme is now set by an inline script in index.html to prevent FOUC
    const currentTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    this.setTheme(currentTheme);
  }

  setTheme(theme) {
    // Force scrollbar refresh by temporarily hiding overflow
    document.documentElement.style.overflow = "hidden";
    // Trigger reflow
    document.body.clientWidth;

    // Update document theme
    document.documentElement.setAttribute("data-theme", theme);

    // Restore overflow to refresh scrollbar with correct color scheme
    document.documentElement.style.overflow = "";

    // Update toggle button icon and state
    const toggleBtn = document.getElementById("theme-toggle-btn");
    const themeIcon = toggleBtn.querySelector(".theme-icon");

    if (theme === "light") {
      themeIcon.textContent = "🌙"; // Show moon to indicate "switch to dark"
      toggleBtn.title = "Switch to Dark Mode";
    } else {
      themeIcon.textContent = "☀️"; // Show sun to indicate "switch to light"
      toggleBtn.title = "Switch to Light Mode";
    }

    // Update syntax highlighting theme
    this.updateSyntaxHighlightTheme(theme);

    // Save theme preference
    localStorage.setItem("font-comparison-theme", theme);

    // Re-render previews to apply new syntax theme
    this.updatePreviews();
  }

  updateSyntaxHighlightTheme(theme) {
    // Remove existing syntax highlight stylesheets
    const existingSyntaxStyles = document.querySelectorAll(
      "link[data-syntax-theme]"
    );
    existingSyntaxStyles.forEach((link) => link.remove());

    // Add appropriate syntax highlight theme
    const syntaxThemeLink = document.createElement("link");
    syntaxThemeLink.rel = "stylesheet";
    syntaxThemeLink.setAttribute("data-syntax-theme", theme);

    if (theme === "dark") {
      syntaxThemeLink.href =
        "https://unpkg.com/@speed-highlight/core/dist/themes/github-dark.css";
    } else {
      syntaxThemeLink.href =
        "https://unpkg.com/@speed-highlight/core/dist/themes/github-light.css";
    }

    document.head.appendChild(syntaxThemeLink);
  }

  initializeFallbackFonts() {
    // Load fallback fonts immediately on page load
    this.populateFallbackFonts();

    // Update button state
    const loadFontsBtn = document.getElementById("load-local-fonts-btn");
    if ("queryLocalFonts" in window) {
      loadFontsBtn.style.display = "block";
    } else {
      loadFontsBtn.style.display = "none";
      console.log("Local Font Access API not supported");
    }
  }

  async loadLocalFonts() {
    const loadFontsBtn = document.getElementById("load-local-fonts-btn");

    try {
      // Update button state
      loadFontsBtn.textContent = "⏳ Loading Fonts...";
      loadFontsBtn.disabled = true;

      // Check if Local Font Access API is supported
      if (!("queryLocalFonts" in window)) {
        throw new Error("Local Font Access API not supported");
      }

      // Request permission and get local fonts (requires user activation)
      const availableFonts = await window.queryLocalFonts();

      if (availableFonts.length === 0) {
        throw new Error("No local fonts accessible");
      }

      // Group fonts by family and sort
      const fontFamilies = new Map();

      for (const fontData of availableFonts) {
        const family = fontData.family;
        if (!fontFamilies.has(family)) {
          fontFamilies.set(family, {
            family: family,
            fullName: fontData.fullName,
            postscriptName: fontData.postscriptName,
            style: fontData.style,
          });
        }
      }

      // Convert to sorted array
      const sortedFonts = Array.from(fontFamilies.values()).sort((a, b) =>
        a.family.localeCompare(b.family)
      );

      // Populate dropdowns with detected fonts
      this.populateSystemFonts(sortedFonts);

      // Update button state - success
      loadFontsBtn.textContent = `✅ Loaded ${sortedFonts.length} Fonts`;
      loadFontsBtn.style.background = "#28a745";

      console.log(
        `Successfully loaded ${sortedFonts.length} local font families`
      );
    } catch (error) {
      console.error("Error accessing local fonts:", error);

      // Update button state - error
      loadFontsBtn.textContent = "❌ Font Access Failed";
      loadFontsBtn.style.background = "#dc3545";

      // Show user-friendly error message
      this.showError(
        `Font access failed: ${error.message}. Using fallback fonts instead.`
      );

      // Keep fallback fonts (don't reload them)
    } finally {
      // Re-enable button after a delay
      setTimeout(() => {
        loadFontsBtn.disabled = false;
        if (loadFontsBtn.textContent.includes("Failed")) {
          loadFontsBtn.textContent = "🔍 Retry System Fonts";
          loadFontsBtn.style.background = "#28a745";
        }
      }, 3000);
    }
  }

  populateSystemFonts(fonts) {
    const font1Group = this.elements.font1Select.querySelector(
      'optgroup[label="System Fonts"]'
    );
    const font2Group = this.elements.font2Select.querySelector(
      'optgroup[label="System Fonts"]'
    );

    // Clear existing system font options
    font1Group.innerHTML = "";
    font2Group.innerHTML = "";

    // Add detected fonts to both dropdowns
    fonts.forEach((font) => {
      // Font 1 dropdown
      const option1 = document.createElement("option");
      option1.value = font.family;
      option1.textContent = font.family;
      option1.style.fontFamily = `"${font.family}", monospace`;
      font1Group.appendChild(option1);

      // Font 2 dropdown
      const option2 = document.createElement("option");
      option2.value = font.family;
      option2.textContent = font.family;
      option2.style.fontFamily = `"${font.family}", monospace`;
      font2Group.appendChild(option2);
    });
  }

  populateFallbackFonts() {
    // Fallback to essential system fonts when Local Font Access API is not available
    const fallbackFonts = ["Arial", "Courier New", "Times New Roman"];

    const systemFonts = fallbackFonts.map((font) => ({
      family: font,
      fullName: font,
      postscriptName: font,
      style: "Regular",
    }));

    this.populateSystemFonts(systemFonts);
    console.log("Using fallback system fonts");
  }

  setDefaultFonts() {
    // Set default fonts after fallback fonts are loaded
    setTimeout(() => {
      // Set Arial for Font 1
      this.elements.font1Select.value = "Arial";
      this.selectFont("Arial", "font1");

      // Set Times New Roman for Font 2
      this.elements.font2Select.value = "Times New Roman";
      this.selectFont("Times New Roman", "font2");
    }, 100);
  }

  initSampleButtons() {
    // No initial state needed - buttons are actions, not state indicators
  }

  setPlaintextSample() {
    const plaintextSample = `the quick brown fox jumps over the lazy dog
THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG
1234567890-=!@#$%^&*()_+`;

    this.elements.sampleText.value = plaintextSample;
    this.elements.languageSelect.value = "plain";
    this.currentLanguage = "plain";

    this.updatePreviews();
  }

  setCodeSample() {
    const codeSample = `// JavaScript example
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log(\`Fibonacci(10) = \${result}\`);`;

    this.elements.sampleText.value = codeSample;
    this.elements.languageSelect.value = "js";
    this.currentLanguage = "js";

    this.updatePreviews();
  }

  async handleFontUpload(files) {
    if (!files || files.length === 0) return;

    for (const file of files) {
      try {
        await this.loadFont(file);
      } catch (error) {
        console.error(`Error loading font ${file.name}:`, error);
        this.showError(`Error loading font ${file.name}: ${error.message}`);
      }
    }

    // Clear the file input
    this.elements.fontUploadInput.value = "";
  }

  selectFont(fontIdentifier, fontKey) {
    if (!fontIdentifier) {
      this.fonts[fontKey] = null;
      this.updateFontName(fontKey, "No font selected");
    } else {
      // Check if it's an uploaded font (starts with 'uploaded:')
      if (fontIdentifier.startsWith("uploaded:")) {
        const fontId = fontIdentifier.replace("uploaded:", "");
        const uploadedFont = this.uploadedFonts.get(fontId);
        if (uploadedFont) {
          this.fonts[fontKey] = {
            family: uploadedFont.family,
            name: uploadedFont.name,
            loaded: true,
            isSystem: false,
          };
          this.updateFontName(fontKey, uploadedFont.name);
        }
      } else {
        // System font
        this.fonts[fontKey] = {
          family: fontIdentifier,
          name: fontIdentifier,
          loaded: true,
          isSystem: true,
        };
        this.updateFontName(fontKey, fontIdentifier);
      }
    }
    this.updatePreviews();
  }

  updateFontName(fontKey, name) {
    const nameElement =
      fontKey === "font1" ? this.elements.font1Name : this.elements.font2Name;
    const titleElement =
      fontKey === "font1"
        ? this.elements.preview1Title
        : this.elements.preview2Title;

    nameElement.textContent = name;
    titleElement.textContent =
      name === "No font selected"
        ? `Font ${fontKey === "font1" ? "1" : "2"} Preview`
        : name;
  }

  async loadFont(file) {
    if (!file) return;

    // Validate file type
    const validTypes = [
      "font/ttf",
      "font/otf",
      "font/woff",
      "font/woff2",
      "application/font-woff",
      "application/font-woff2",
      "application/x-font-ttf",
      "application/x-font-otf",
    ];

    const fileExtension = file.name.toLowerCase().split(".").pop();
    const validExtensions = ["ttf", "otf", "woff", "woff2"];

    if (
      !validTypes.includes(file.type) &&
      !validExtensions.includes(fileExtension)
    ) {
      throw new Error(
        `Invalid font file type. Please upload a TTF, OTF, WOFF, or WOFF2 file.`
      );
    }

    // Create a unique font family name and ID
    const fontId = `font_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const fontFamily = `CustomFont_${fontId}`;

    // Read file as ArrayBuffer
    const arrayBuffer = await this.readFileAsArrayBuffer(file);

    // Create font face
    const fontFace = new FontFace(fontFamily, arrayBuffer);

    // Load the font
    await fontFace.load();

    // Add to document fonts
    document.fonts.add(fontFace);

    // Store uploaded font info
    const fontInfo = {
      id: fontId,
      family: fontFamily,
      name: file.name,
      loaded: true,
    };

    this.uploadedFonts.set(fontId, fontInfo);

    // Add to both dropdown menus
    this.addFontToDropdowns(fontInfo);

    // Show success notification
    this.showSuccess(`Font "${file.name}" uploaded successfully!`);
  }

  addFontToDropdowns(fontInfo) {
    // Add to Font 1 dropdown
    const font1Group = document.getElementById("font1-uploaded-group");
    const font1Option = document.createElement("option");
    font1Option.value = `uploaded:${fontInfo.id}`;
    font1Option.textContent = fontInfo.name;
    font1Option.style.fontFamily = `"${fontInfo.family}", monospace`;
    font1Group.appendChild(font1Option);

    // Add to Font 2 dropdown
    const font2Group = document.getElementById("font2-uploaded-group");
    const font2Option = document.createElement("option");
    font2Option.value = `uploaded:${fontInfo.id}`;
    font2Option.textContent = fontInfo.name;
    font2Option.style.fontFamily = `"${fontInfo.family}", monospace`;
    font2Group.appendChild(font2Option);
  }

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  }

  updatePreviews() {
    const sampleText =
      this.elements.sampleText.value.trim() || "(sample text missing)";

    // Update font 1 preview
    if (this.fonts.font1 && this.fonts.font1.loaded) {
      this.updatePreviewElement(
        this.elements.preview1,
        sampleText,
        this.fonts.font1.family,
        false
      );
    } else {
      this.updatePreviewElement(
        this.elements.preview1,
        "Upload a font to see the preview",
        "",
        true
      );
    }

    // Update font 2 preview
    if (this.fonts.font2 && this.fonts.font2.loaded) {
      this.updatePreviewElement(
        this.elements.preview2,
        sampleText,
        this.fonts.font2.family,
        false
      );
    } else {
      this.updatePreviewElement(
        this.elements.preview2,
        "Upload a font to see the preview",
        "",
        true
      );
    }
  }

  updatePreviewElement(element, text, fontFamily, isPlaceholder) {
    // Clear previous content and classes
    element.innerHTML = "";
    element.className = "preview-text";

    if (isPlaceholder) {
      element.textContent = text;
      element.classList.add("placeholder-text");
      element.style.fontFamily = "";
      element.style.fontSize = "";
      return;
    }

    // Set base styles
    element.style.fontSize = `${this.currentFontSize}px`;
    element.style.lineHeight = 1.4;

    if (this.currentLanguage === "plain" || !this.highlighter) {
      // Plain text mode
      element.textContent = text;
      element.style.fontFamily = `"${fontFamily}", "ANDFallback"`;
    } else {
      // Syntax highlighting mode
      element.textContent = text;
      element.className = `preview-text shj-lang-${this.currentLanguage}`;

      try {
        // Apply syntax highlighting
        this.highlighter.highlightElement(element, this.currentLanguage);

        // Apply custom font to all syntax-highlighted elements
        this.applyFontToHighlightedElements(element, fontFamily);
      } catch (error) {
        console.error("Syntax highlighting failed:", error);
        // Fallback to plain text
        element.textContent = text;
        element.style.fontFamily = `"${fontFamily}", "ANDFallback"`;
      }
    }
  }

  applyFontToHighlightedElements(container, fontFamily) {
    // Apply font to the container
    container.style.fontFamily = `"${fontFamily}", "ANDFallback"`;

    // Apply font to all child elements (syntax highlighted tokens)
    const highlightedElements = container.querySelectorAll("*");
    highlightedElements.forEach((el) => {
      el.style.fontFamily = `"${fontFamily}", "ANDFallback"`;
    });
  }

  setupDragAndDrop() {
    const uploadContent = document.querySelector(".upload-content");

    // Prevent default drag behaviors
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      uploadContent.addEventListener(eventName, this.preventDefaults, false);
      document.body.addEventListener(eventName, this.preventDefaults, false);
    });

    // Highlight drop area when item is dragged over it
    ["dragenter", "dragover"].forEach((eventName) => {
      uploadContent.addEventListener(
        eventName,
        () => {
          uploadContent.classList.add("drag-over");
        },
        false
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      uploadContent.addEventListener(
        eventName,
        () => {
          uploadContent.classList.remove("drag-over");
        },
        false
      );
    });

    // Handle dropped files
    uploadContent.addEventListener(
      "drop",
      (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        this.handleFontUpload(files);
      },
      false
    );
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  showError(message) {
    this.showToast(message, "#ff4757");
  }

  showSuccess(message) {
    this.showToast(message, "#28a745");
  }

  showToast(message, backgroundColor) {
    // Create a toast notification
    const toastDiv = document.createElement("div");
    toastDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${backgroundColor};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            max-width: 400px;
            font-weight: 500;
        `;
    toastDiv.textContent = message;

    document.body.appendChild(toastDiv);

    // Remove after 5 seconds
    setTimeout(() => {
      if (toastDiv.parentNode) {
        toastDiv.parentNode.removeChild(toastDiv);
      }
    }, 5000);
  }
}

// Initialize the font comparator when the page loads
document.addEventListener("DOMContentLoaded", () => {
  new FontComparator();
});
