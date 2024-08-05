/**
 * Sets up a glyph browser interface with search, filtering, and interaction functionalities.
 */

function setupGlyphBrowser() {
  const searchBar = document.getElementById("searchBar");
  const results = document.getElementById("results");
  const glyphCount = document.getElementById("glyphCount");
  const checkboxesContainer = document.getElementById("checkboxes");
  const stylesButtonsContainer = document.getElementById(
    "stylesButtonsContainer"
  );

  let allGlyphs = [];
  let filteredGlyphs = [];
  let displayedGlyphs = [];
  let loadCount = 0;

  const GLYPHS_PER_LOAD = 200;
  const INITIAL_LOAD_COUNT = 500;
  let packs = new Set();

  const updateGlyphCount = (count) => {
    glyphCount.textContent = count;
  };

  const downloadFile = (url, filename) => {
    fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.style.display = "none";
        anchor.href = url;
        anchor.setAttribute("download", filename);
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
      })
      .catch((error) => console.error("Download failed:", error));
  };

  const copyToClipboard = (
    glyphCharacter,
    glyphName,
    glyphUnicode,
    glyphPack
  ) => {
    navigator.clipboard
      .writeText(glyphCharacter)
      .then(() => {
        // Create toast container if not already existing
        let toastContainer = document.querySelector(".toast-container");
        if (!toastContainer) {
          toastContainer = document.createElement("div");
          toastContainer.className =
            "toast-container position-fixed bottom-0 end-0 p-3";
          document.body.appendChild(toastContainer);
        }

        const toastElement = document.createElement("div");
        toastElement.className = "toast";
        toastElement.setAttribute("role", "alert");
        toastElement.setAttribute("aria-live", "polite");
        toastElement.setAttribute("aria-atomic", "true");

        const toastHeader = document.createElement("div");
        toastHeader.className = "toast-header";

        const glyphChar = document.createElement("span");
        glyphChar.className = "me-2";
        glyphChar.textContent = glyphCharacter;
        toastHeader.appendChild(glyphChar);

        const toastTitle = document.createElement("strong");
        toastTitle.className = "me-auto";
        toastTitle.textContent = "Copied!";
        toastHeader.appendChild(toastTitle);

        const smallElement = document.createElement("small");
        smallElement.className = "text-body-secondary";
        smallElement.textContent = `${glyphPack} | U+${glyphUnicode}`;
        toastHeader.appendChild(smallElement);

        const toastBody = document.createElement("div");
        toastBody.className = "toast-body";

        const downloadButton = document.createElement("button");
        downloadButton.className = "btn btn-secondary btn-sm me-2";
        downloadButton.setAttribute("type", "button");
        downloadButton.textContent = "Download SVG";

        // Add click event listener to trigger download
        downloadButton.addEventListener("click", function () {
          const filename = `${glyphName}.svg`;
          const downloadUrl = `https://raw.githubusercontent.com/iconicFonts/if/main/packs/${glyphPack}/svgs/${filename}`;
          downloadFile(downloadUrl, filename);
        });

        // Create copy SVG content button
        const copySVGButton = document.createElement("button");
        copySVGButton.className = "btn  btn-secondary btn-sm";
        copySVGButton.setAttribute("type", "button");
        copySVGButton.textContent = "Copy SVG";

        // Add click event listener to copy SVG content
        copySVGButton.addEventListener("click", async function () {
          try {
            const filename = `${glyphName}.svg`;
            const response = await fetch(
              `https://raw.githubusercontent.com/iconicFonts/if/main/packs/${glyphPack}/svgs/${filename}`
            );
            const svgContent = await response.text();
            navigator.clipboard.writeText(svgContent);
            toastBody.textContent = `SVG content copied to clipboard!`;
          } catch (error) {
            console.error("Failed to copy SVG content:", error);
            toastBody.textContent = `Failed to copy SVG content.`;
          }
        });

        toastElement.appendChild(toastHeader);
        toastElement.appendChild(toastBody);
        toastBody.appendChild(downloadButton);
        toastBody.appendChild(copySVGButton);

        toastContainer.appendChild(toastElement);

        const bsToast = new bootstrap.Toast(toastElement);
        bsToast.show();

        toastElement.addEventListener("hidden.bs.toast", () => {
          toastElement.remove();
          // Remove toast container if no toasts are left
          if (toastContainer.childElementCount === 0) {
            toastContainer.remove();
          }
        });
      })
      .catch((error) => {
        console.error("Failed to copy:", error);
      });
  };

  const initializeGlyphContainer = () => {
    if (filteredGlyphs.length > 0) {
      const firstGlyph = filteredGlyphs[0];
      updateGlyphContainer(firstGlyph.name, firstGlyph.character);
    }
  };

  const createButton = (glyph) => {
    const button = document.createElement("button");
    button.className = "btn mt-2 me-2 btn-glyph";

    button.innerHTML = glyph.character;

    initializeGlyphContainer();

    const handleMouseLeave = () => {
      initializeGlyphContainer();
    };
    button.addEventListener("mouseleave", handleMouseLeave);

    button.addEventListener("mouseenter", () => {
      updateGlyphContainer(`${glyph.name}_${glyph.pack}`, glyph.character);
    });

    button.addEventListener("mouseleave", () => {
      initializeGlyphContainer();
    });

    button.addEventListener("click", () => {
      copyToClipboard(glyph.character, glyph.name, glyph.unicode, glyph.pack);
    });

    return button;
  };

  const showResults = (glyphs) => {
    glyphs.forEach((glyph) => {
      const button = createButton(glyph);
      results.appendChild(button);
    });
  };

  const fetchData = () => {
    fetch("if.csv")
      .then((response) => response.text())
      .then((data) => {
        const parsedData = Papa.parse(data, {
          header: true,
          skipEmptyLines: true,
        }).data;
        allGlyphs = parsedData.filter((row) => row.pack);

        allGlyphs.forEach((glyph) => packs.add(glyph.pack));
        initializeCheckboxes();
        filterGlyphs("");
      })
      .catch((error) => {
        console.error("Error fetching the glyphs data:", error);
      });
  };

  const filterGlyphs = (searchTerm) => {
    let filtered = allGlyphs;

    if (searchTerm) {
      const lowerCaseTerm = searchTerm.toLowerCase();

      // Use fuzzysort to perform fuzzy search on multiple properties
      const fuzzyResults = fuzzysort.go(lowerCaseTerm, filtered, {
        keys: ["name", "unicode", "character", "tags", "pack"],
        // limit: 50,
        threshold: 0.5,
      });

      filtered = fuzzyResults.map((result) => result.obj);
    }

    const selectedPacks = getSelectedPacks();

    if (selectedPacks.length > 0) {
      filtered = filtered.filter((glyph) => selectedPacks.includes(glyph.pack));
    }

    const selectedStyles = getSelectedStyles();

    if (selectedStyles.length > 0) {
      filtered = filtered.filter((glyph) =>
        selectedStyles.includes(glyph.style)
      );
    }

    filteredGlyphs = filtered;

    updateGlyphCount(filteredGlyphs.length);

    results.innerHTML = "";
    displayedGlyphs = [];
    loadCount = 0;

    loadInitialGlyphs();
  };

  const getSelectedStyles = () => {
    const activeButtons = Array.from(
      stylesButtonsContainer.querySelectorAll(".btn.active")
    );
    return activeButtons.map((button) => button.getAttribute("data-style"));
  };

  const loadInitialGlyphs = () => {
    const initialGlyphs = filteredGlyphs.slice(0, INITIAL_LOAD_COUNT);
    displayedGlyphs = initialGlyphs;
    showResults(initialGlyphs);
    loadCount = Math.ceil(INITIAL_LOAD_COUNT / GLYPHS_PER_LOAD);

    ensureScrollbar();
  };

  const loadMoreGlyphs = () => {
    const start = loadCount * GLYPHS_PER_LOAD;
    const end = start + GLYPHS_PER_LOAD;
    const glyphsToShow = filteredGlyphs.slice(start, end);

    if (glyphsToShow.length > 0) {
      displayedGlyphs = displayedGlyphs.concat(glyphsToShow);
      showResults(glyphsToShow);
      loadCount++;
    }
  };

  const ensureScrollbar = () => {
    if (document.body.scrollHeight <= window.innerHeight) {
      if (loadCount * GLYPHS_PER_LOAD < filteredGlyphs.length) {
        loadMoreGlyphs();
      }
    }
  };

  const handleScroll = () => {
    if (
      window.innerHeight + window.scrollY >=
      document.body.offsetHeight - 200
    ) {
      if (loadCount * GLYPHS_PER_LOAD < filteredGlyphs.length) {
        loadMoreGlyphs();
      }
    }
  };

  const createStylesButton = (style) => {
    const button = document.createElement("button");
    button.classList.add("btn", "btn-secondary");
    button.textContent = style;
    button.setAttribute("data-style", style); // Store style information in data attribute

    // Add event listener for button click
    button.addEventListener("click", () => {
      // Toggle active class
      button.classList.toggle("active");
      // Trigger filter function
      filterGlyphs(searchBar.value, getSelectedStyles());
    });

    return button;
  };

  const createCheckbox = (pack) => {
    const checkboxId = `checkbox-${pack}`;
    const div = document.createElement("div");
    div.className = "ms-1 form-check";

    const input = document.createElement("input");
    input.className = "form-check-input";
    input.type = "checkbox";
    input.value = pack;
    input.id = checkboxId;

    const label = document.createElement("label");
    label.className = "form-check-label";
    label.htmlFor = checkboxId;
    label.textContent = pack;

    div.appendChild(input);
    div.appendChild(label);
    return div;
  };

  const downloadSelectedPackFile = (url, filename) => {
    fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename; // Ensure the file is downloaded with the specified filename
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        // Delay revoking the object URL to ensure the download starts
        setTimeout(() => URL.revokeObjectURL(url), 100);
      })
      .catch((error) => console.error("Download failed:", error));
  };

  const initializeStylesButtons = () => {
    const styles = ["solid", "regular", "circle", "square"];
    const characters = ["󴊋", "★", "⬤", "■"];
    const stylesButtonsContainer = document.getElementById(
      "stylesButtonsContainer"
    );
    const fragment = document.createDocumentFragment();

    styles.forEach((style, index) => {
      const character = characters[index];
      const button = createStylesButton(`${character} ${style}`);
      fragment.appendChild(button);
    });

    stylesButtonsContainer.appendChild(fragment);

    // Add event listener to the container for event delegation
    stylesButtonsContainer.addEventListener("click", (event) => {
      const targetButton = event.target.closest(".btn");
      if (targetButton) {
        filterGlyphs(searchBar.value, getSelectedStyles());
      }
    });
  };

  // Initialize checkboxes and styles checkboxes
  initializeStylesButtons();

  const initializeCheckboxes = () => {
    packs.forEach((pack) => {
      const containerDiv = document.createElement("div");
      containerDiv.classList.add("d-flex", "justify-content-between");

      const checkbox = createCheckbox(pack);

      const downloadButton = document.createElement("button");
      downloadButton.className = "btn btn-secondary btn-sm mb-2";
      downloadButton.setAttribute("type", "button");
      downloadButton.textContent = "Download";

      // Add click event listener to download button
      downloadButton.addEventListener("click", function () {
        const filename = `${pack}.svg`;
        const downloadUrl = `https://raw.githubusercontent.com/iconicFonts/if/main/packs/${pack}/svgs.zip`;
        downloadSelectedPackFile(downloadUrl, filename);
      });

      // Append the checkbox and download button to the container div
      containerDiv.appendChild(checkbox);
      containerDiv.appendChild(downloadButton);

      // Append the container div to the checkboxes container
      checkboxesContainer.appendChild(containerDiv);
    });

    // Add change event listeners to all checkboxes
    checkboxesContainer
      .querySelectorAll('input[type="checkbox"]')
      .forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          filterGlyphs(searchBar.value);
        });
      });
  };

  const getSelectedPacks = () => {
    return Array.from(
      checkboxesContainer.querySelectorAll('input[type="checkbox"]:checked')
    ).map((checkbox) => checkbox.value);
  };

  const updateGlyphContainer = (glyphName, glyphIcon) => {
    const glyphContainer = document.getElementById("glyphContainer");

    // Clear existing content inside glyphContainer
    while (glyphContainer.firstChild) {
      glyphContainer.removeChild(glyphContainer.firstChild);
    }

    // Create new elements
    const glyphCharName = document.createElement("div");
    glyphCharName.className = "fs-6";
    glyphCharName.textContent = glyphName;

    const glyphCharIcon = document.createElement("div");
    glyphCharIcon.className = "display-1 mb-3";
    glyphCharIcon.textContent = glyphIcon;

    // Append new elements to glyphContainer
    glyphContainer.appendChild(glyphCharName);
    glyphContainer.appendChild(glyphCharIcon);
  };

  searchBar.addEventListener("input", () => {
    filterGlyphs(searchBar.value);
  });

  window.addEventListener("scroll", handleScroll);

  fetchData();
}

/**
 * Initializes a color picker input and updates button
 * colors based on user selection.
 */
function initializeColorPicker() {
  const colorPickerContainer = document.getElementById("colorPickerContainer");

  if (!colorPickerContainer) {
    console.error("Color picker container not found.");
    return;
  }

  const input = document.createElement("input");
  input.setAttribute("type", "color");
  input.className = "form-control form-control-color";
  input.id = "exampleColorInput";

  // Get the default color value from the --text CSS variable
  const defaultColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--text")
    .trim();
  input.value = defaultColor;
  input.title = "Choose your color";

  input.addEventListener("input", (event) => {
    const newColor = event.target.value;
    document.querySelectorAll(".btn-glyph").forEach((button) => {
      button.style.setProperty("--bs-btn-color", newColor);
    });
  });

  colorPickerContainer.appendChild(input);
}

/**
 * Creates a navbar item with a link based on provided parameters.
 * @param {string} name - The name of the navigation item.
 * @param {string} href - The URL the navigation item should link to.
 * @param {boolean} isActive - Indicates if the navigation item should be marked as active.
 * @returns {HTMLLIElement} - The created list item element containing the link.
 */
function createNavbarItem(name, href, isActive) {
  const li = document.createElement("li");
  li.className = "nav-item";

  const a = document.createElement("a");
  a.className = `nav-link${isActive ? " active" : ""}`;
  a.href = href;
  a.textContent = name;

  li.appendChild(a);
  return li;
}

/**
 * Inserts a navbar based on the current page's file name.
 */
function insertNavbar() {
  // Get the current page's file name
  const currentPage = window.location.pathname
    .split("/")
    .pop()
    .replace(".html", "")
    .toLowerCase();

  const nav = document.createElement("nav");
  nav.className = "navbar navbar-expand-lg bg-body-tertiary";

  const containerDiv = document.createElement("div");
  containerDiv.className = "container-lg";

  const brand = document.createElement("a");
  brand.className = "navbar-brand";
  brand.href = "index.html";

  const brandImage = document.createElement("img");
  brandImage.src = "./favicon.svg";
  brandImage.alt = "IconicFonts";
  brandImage.width = "24";
  brandImage.height = "24";
  brand.appendChild(brandImage);
  brand.appendChild(document.createTextNode(" IconicFonts"));
  containerDiv.appendChild(brand);

  const button = document.createElement("button");
  button.className = "navbar-toggler";
  button.type = "button";
  button.setAttribute("data-bs-toggle", "collapse");
  button.setAttribute("data-bs-target", "#navbarSupportedContent");
  button.setAttribute("aria-controls", "navbarSupportedContent");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Toggle navigation");

  const buttonSpan = document.createElement("span");
  buttonSpan.className = "navbar-toggler-icon";
  button.appendChild(buttonSpan);

  const collapseDiv = document.createElement("div");
  collapseDiv.className = "collapse navbar-collapse";
  collapseDiv.id = "navbarSupportedContent";

  const ul = document.createElement("ul");
  ul.className = "navbar-nav me-auto mb-2 mb-lg-0";

  const pages = [
    { name: "Icons", href: "icons.html" },
    { name: "Fonts", href: "fonts.html" },
    { name: "License", href: "license.html" },
  ];

  pages.forEach((page) => {
    const isActive =
      currentPage === page.href.replace(".html", "").toLowerCase();
    ul.appendChild(createNavbarItem(page.name, page.href, isActive));
  });

  collapseDiv.appendChild(ul);
  containerDiv.appendChild(brand);
  containerDiv.appendChild(button);
  containerDiv.appendChild(collapseDiv);
  nav.appendChild(containerDiv);

  document.getElementById("navbar-container").appendChild(nav);
}

/**
 * Loads fonts dynamically by creating @font-face rules based on provided font data.
 * @param {Array} fonts - Array of font objects containing name and font file URL.
 */

function loadFonts(fonts) {
  const fontStyles = document.getElementById("fontStyles");
  fonts.forEach((font) => {
    const fontFace = `@font-face {
                  font-family: "${font.name}";
                  src: url(${font.fontFile}) format('woff2');
              }`;
    fontStyles.textContent += fontFace;
  });
}

function createLanguageSelect(defaultLanguage, onChangeCallback) {
  const selectElement = document.createElement("select");
  selectElement.classList.add("form-select");
  selectElement.setAttribute("aria-label", "Select language");

  const languages = [
    { value: "css", label: "CSS", className: "language-css" },
    { value: "html", label: "HTML", className: "language-html" },
    {
      value: "javascript",
      label: "JavaScript",
      className: "language-javascript",
    },
  ];

  languages.forEach((lang) => {
    const option = document.createElement("option");
    option.value = lang.value;
    option.textContent = lang.label;
    if (lang.value === defaultLanguage) {
      option.selected = true;
    }
    selectElement.appendChild(option);
  });

  selectElement.addEventListener("change", function () {
    onChangeCallback(this.value);
  });

  return selectElement;
}

function createCodeElement(language) {
  const codeElement = document.createElement("code");

  async function fetchSyntaxFromFile(filename) {
    const response = await fetch(`code-snippets/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filename}: ${response.status}`);
    }
    return await response.text();
  }

  async function setCodeContent(filename, languageClass) {
    try {
      const syntax = await fetchSyntaxFromFile(filename);
      codeElement.textContent = syntax;
      codeElement.setAttribute("class", languageClass);
      Prism.highlightElement(codeElement);
    } catch (error) {
      console.error("Error fetching syntax:", error);
    }
  }

  switch (language) {
    case "css":
      setCodeContent("css", "language-css");
      break;
    case "html":
      setCodeContent("html", "language-html");
      break;
    case "javascript":
    default:
      setCodeContent("javascript", "language-js");
      break;
  }

  return codeElement;
}

function appendFontDetails(container, font) {
  document.createElement("div");
  const containerDiv = document.createElement("div");
  containerDiv.className = "container text-center";

  const rowDiv = document.createElement("div");
  rowDiv.className = "row align-items-start";
  containerDiv.appendChild(rowDiv);

  const firstColDiv = document.createElement("div");
  firstColDiv.className = "col";
  rowDiv.appendChild(firstColDiv);

  const secondColDiv = document.createElement("div");
  secondColDiv.className = "col";
  rowDiv.appendChild(secondColDiv);

  const pre = document.createElement("pre");
  pre.setAttribute("contenteditable", "true");
  firstColDiv.appendChild(pre);

  const code = createCodeElement("javascript");
  code.style.fontFamily = `"${font.name}", monospace`;
  pre.appendChild(code);

  const text = document.createElement("p");
  text.textContent = `Text displayed with ${font.name}`;
  secondColDiv.appendChild(text);

  const downloadButton = document.createElement("a");
  downloadButton.textContent = "Download Font";
  downloadButton.href = font.fontFile;
  downloadButton.setAttribute("download", `${font.name}.woff2`);
  secondColDiv.appendChild(downloadButton);

  const fontInfo = document.createElement("p");
  fontInfo.textContent = `Version: ${font.version}`;
  secondColDiv.appendChild(fontInfo);

  container.appendChild(containerDiv);
}

function displayFonts(fonts, containerId) {
  const textContainer = document.getElementById(containerId);
  textContainer.innerHTML = "";

  // Create global language select element
  const languageSelect = createLanguageSelect(
    "javascript",
    function (language) {
      document.querySelectorAll("pre code").forEach((codeElement) => {
        const preElement = codeElement.parentNode;
        preElement.innerHTML = "";
        const newCodeElement = createCodeElement(language);
        preElement.appendChild(newCodeElement);
      });
    }
  );

  // Attach the global select element to an existing button by ID
  const selectButtonContainer = document.getElementById("languageSelectButton");
  selectButtonContainer.appendChild(languageSelect);

  fonts.forEach((font, index) => {
    const fontContainer = document.createElement("div");
    fontContainer.style.fontFamily = `"${font.name}"`;
    fontContainer.className = "accordion-item";

    const h2Element = document.createElement("h2");
    h2Element.classList.add("accordion-header");

    const buttonElement = document.createElement("button");
    index === 0
      ? buttonElement.classList.add("accordion-button")
      : buttonElement.classList.add("accordion-button", "collapsed");

    buttonElement.type = "button";
    buttonElement.setAttribute("data-bs-toggle", "collapse");
    buttonElement.setAttribute("data-bs-target", `#collapse${font.name}`);
    buttonElement.setAttribute("aria-controls", `collapse${font.name}`);
    buttonElement.textContent = font.name;
    index === 0
      ? buttonElement.setAttribute("aria-expanded", "true")
      : buttonElement.setAttribute("aria-expanded", "false");

    h2Element.appendChild(buttonElement);
    fontContainer.appendChild(h2Element);

    const collapseDiv = document.createElement("div");
    collapseDiv.id = `collapse${font.name}`;
    index === 0
      ? collapseDiv.classList.add("accordion-collapse", "collapse", "show")
      : collapseDiv.classList.add("accordion-collapse", "collapse");

    collapseDiv.setAttribute("data-bs-parent", `#${containerId}`);

    const accordionBodyDiv = document.createElement("div");
    accordionBodyDiv.classList.add("accordion-body");

    appendFontDetails(accordionBodyDiv, font);

    collapseDiv.appendChild(accordionBodyDiv);
    fontContainer.appendChild(collapseDiv);

    textContainer.appendChild(fontContainer);
  });

  Prism.highlightAll();
}

// Adding search functionality
function addSearchFunctionality(fonts, searchContainerId, mainContainerId) {
  const searchInput = document.getElementById("searchInput");
  const searchResultsContainer = document.getElementById(searchContainerId);
  const mainContainer = document.getElementById(mainContainerId);

  // Function to update the URL with the search term
  function updateURLWithSearchTerm(term) {
    const url = new URL(window.location);
    if (term) {
      url.searchParams.set("search", term);
    } else {
      url.searchParams.delete("search");
    }
    window.history.pushState({}, "", url);
  }

  searchInput.addEventListener("input", function () {
    const query = searchInput.value.toLowerCase();

    updateURLWithSearchTerm(query);

    if (query.trim() === "") {
      // Clear search results and display main container
      searchResultsContainer.innerHTML = "";
      mainContainer.style.display = "block";
    } else {
      // Hide main container and display search results
      searchResultsContainer.innerHTML = "";
      mainContainer.style.display = "none";

      fonts.forEach((font) => {
        const fontName = font.name.toLowerCase();
        if (fontName.includes(query)) {
          appendFontDetails(searchResultsContainer, font);
        }
      });
    }
  });
}

// Function to handle initial search based on URL
function handleInitialSearch(fonts, searchContainerId, mainContainerId) {
  const urlParams = new URLSearchParams(window.location.search);
  const searchTerm = urlParams.get("search");
  if (searchTerm) {
    const searchInput = document.getElementById("searchInput");
    searchInput.value = searchTerm;
    addSearchFunctionality(fonts, searchContainerId, mainContainerId);
    searchInput.dispatchEvent(new Event("input"));
  }
}

// Function to update font size of code blocks in style element
function updateCodeFontSize(rangeValue) {
  const styleElement = document.getElementById("fontStyles");
  const fontSize = rangeValue + "px";

  // Update the style content for code elements
  styleElement.textContent = `
    code {
      font-size: ${fontSize} !important;
    }
  `;
}

function main() {
  insertNavbar();

  document.addEventListener("DOMContentLoaded", function () {
    const currentPage = window.location.pathname
      .split("/")
      .pop()
      .replace(".html", "")
      .toLowerCase();

    // Check if the current HTML file is named 'icons'
    if (currentPage === "icons") {
      setupGlyphBrowser();
      initializeColorPicker();
    } else if (currentPage === "fonts") {
      fetch("fonts.json")
        .then((response) => response.json())
        .then((fonts) => {
          loadFonts(fonts);
          displayFonts(fonts, "accordionExample");

          addSearchFunctionality(fonts, "searchResults", "accordionExample");
          handleInitialSearch(fonts, "searchResults", "accordionExample");

          (function () {
            const rangeInput = document.getElementById("customRange1");

            rangeInput.addEventListener("input", function () {
              updateCodeFontSize(this.value);
            });

            updateCodeFontSize(rangeInput.value); // Initialize font size
          })();
        })
        .catch((error) => console.error("Error loading fonts.json:", error));
    }
  });
}

main();
