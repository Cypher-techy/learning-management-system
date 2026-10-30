import type { Assignment, Course, Quiz } from "../db";
import { L, S, t, h, code, ex, tip, note, list, steps, table, exercise, tutorialCourse } from "./shared";

export const htmlCourse: Course = tutorialCourse({
  id: "html-web-foundations", title: "HTML & Web Foundations Tutorial",
  subtitle: "Learn HTML, CSS and JavaScript basics with notes, examples and live practice",
  description: "A W3Schools-style, learn-by-doing tutorial: every lesson is short, shows real code you can run and edit right here, and ends with a quick exercise. Start from zero and finish by building your own web page.",
  category: "Technology", tutorId: "u_tutor1", image: "photo-1547658719-da2b51169166",
  objectives: ["Build a complete web page with HTML", "Use headings, links, images, lists, tables and forms", "Style pages with CSS (colours, box model, flex layout)", "Add simple interactivity with JavaScript"],
  requirements: ["Any computer or smartphone with a browser", "No prior coding experience — we start from the very beginning"],
  sections: [
    S("html-web-foundations-s1", "HTML Basics", [
      L("html-intro", "HTML Introduction", 6, [
        t("**HTML** stands for **HyperText Markup Language**. It is the standard language for creating web pages — it describes the *structure* of a page using elements like headings, paragraphs and links."),
        h("A simple HTML document"),
        ex(`<!DOCTYPE html>
<html>
<head>
  <title>My First Page</title>
</head>
<body>
  <h1>Karibu Kenya!</h1>
  <p>This is my first web page.</p>
</body>
</html>`),
        list(["`<!DOCTYPE html>` tells the browser: this is an HTML5 page", "`<html>` is the root — everything lives inside it", "`<head>` holds information *about* the page (like its title)", "`<body>` holds everything the visitor **sees**", "`<h1>` is a big heading; `<p>` is a paragraph"]),
        tip("Press **Run** on any example in this tutorial, change the words, and run it again. Breaking things safely is the fastest way to learn."),
        exercise("In the example above, which part of the page does the visitor actually see — head or body?", "The <body>. The <head> contains behind-the-scenes information like the page title shown on the browser tab."),
      ], true),
      L("html-editors", "HTML Editors", 5, [
        t("You can write HTML in any text editor. Professionals use **VS Code** (free), but Notepad or TextEdit also work — and in this tutorial you can practise inside the examples themselves."),
        h("Create your first file"),
        steps(["Open your editor and write (or paste) HTML code", "Save the file as `index.html` — the `.html` ending is essential", "Find the file and double-click it: your browser opens your page", "Change the code, save, then refresh the browser (`F5`) to see the update"]),
        note("On Windows Notepad, choose **Save as type: All Files** so it saves `index.html` and not `index.html.txt`."),
        exercise("You saved your page but double-clicking opens it in a text editor as plain code. What likely went wrong?", "The file is probably named index.html.txt (a text file). Re-save with the name index.html and “All Files” type so the browser renders it."),
      ]),
      L("html-structure", "HTML Basic Structure", 6, [
        t("Every HTML page follows the same skeleton. Elements usually come in pairs: an **opening tag** `<p>` and a **closing tag** `</p>`, with content in between."),
        ex(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>About Nairobi</title>
</head>
<body>
  <h1>Nairobi</h1>
  <p>Nairobi is the capital city of Kenya.</p>
  <p>It is famous for Nairobi National Park.</p>
</body>
</html>`),
        list(["`<meta charset=\"UTF-8\">` makes characters — including Kiswahili text — display correctly", "`lang=\"en\"` declares the page language (helps search engines and screen readers)", "Tags are **not** case-sensitive, but lowercase is the convention"]),
        tip("Think of elements as boxes inside boxes: paragraphs sit inside body, body sits inside html. Always close boxes in the reverse order you opened them."),
        exercise("Fix this code: `<p>Habari <b>rafiki</p></b>` — what is wrong?", "The closing order is wrong. Correct nesting: <p>Habari <b>rafiki</b></p> — close the inner <b> before the outer <p>."),
      ]),
      L("html-elements-attrs", "HTML Elements & Attributes", 8, [
        t("**Attributes** give extra information about an element. They live inside the opening tag as `name=\"value\"` pairs."),
        table(["Attribute", "Used on", "Purpose", "Example"], [
          ["href", "<a>", "Where a link goes", "`<a href=\"https://example.com\">`"],
          ["src", "<img>", "Image file location", "`<img src=\"photo.jpg\">`"],
          ["alt", "<img>", "Text description of the image", "`alt=\"Lake Naivasha\"`"],
          ["title", "most elements", "Tooltip on hover", "`title=\"More info\"`"],
          ["id / class", "all elements", "Hooks for CSS & JavaScript", "`class=\"big\"`"],
        ]),
        ex(`<!DOCTYPE html>
<html>
<body>
  <h2 title="Hovering shows a tooltip!">Hover over me</h2>
  <a href="https://www.google.com" target="_blank">Open Google in a new tab</a>
</body>
</html>`),
        h("Empty (void) elements"),
        t("Some elements have no closing tag because they hold no content: `<br>` (line break), `<hr>` (horizontal line), `<img>`, `<meta>`."),
        exercise("Which attribute tells a browser where an image file is, and which describes it for someone who cannot see it?", "src gives the location; alt gives the description (read aloud by screen readers and shown if the image fails to load)."),
      ]),
      L("html-headings", "HTML Headings & Paragraphs", 7, [
        t("Headings run from `<h1>` (most important) to `<h6>` (least). Search engines and screen readers use them as the page outline — use them for structure, not just size."),
        ex(`<!DOCTYPE html>
<html>
<body>
  <h1>Kenya</h1>
  <h2>Rift Valley</h2>
  <h3>Naivasha</h3>
  <p>A paragraph always starts on a new line.</p>
  <hr>
  <p>This paragraph has a<br>line break inside it.</p>
</body>
</html>`),
        list(["Use **one** `<h1>` per page — the main title", "`<p>` adds space before and after the paragraph automatically", "`<hr>` draws a thematic divider line; `<br>` breaks a line without a new paragraph"]),
        note("Browsers ignore extra spaces and new lines inside your HTML. Use `<p>` and `<br>` to control layout — not the spacebar."),
        exercise("A page about your school needs a main title and three section titles. Which tags and how many of each?", "One <h1> for the school name (main title) and three <h2> tags, one per section."),
      ]),
      L("html-formatting", "HTML Text Formatting", 6, [
        table(["Element", "Meaning"], [
          ["`<b>` / `<strong>`", "Bold — strong adds *importance*"],
          ["`<i>` / `<em>`", "Italic — em adds *emphasis*"],
          ["`<mark>`", "Highlighted text"],
          ["`<small>`", "Smaller print"],
          ["`<del>` / `<ins>`", "Deleted / inserted text"],
          ["`<sub>` / `<sup>`", "Subscript / superscript — H₂O, m²"],
        ]),
        ex(`<!DOCTYPE html>
<html>
<body>
  <p>Water is H<sub>2</sub>O. Our plot is 50 m<sup>2</sup>.</p>
  <p>Fees: <del>KSh 5,000</del> <ins>KSh 4,500</ins> this term.</p>
  <p>Remember to carry your <mark>national ID</mark>.</p>
</body>
</html>`),
        exercise("Write the HTML so that in “E = mc2” the 2 appears raised.", "E = mc<sup>2</sup> — sup means superscript."),
      ]),
      L("html-links-images", "HTML Links & Images", 8, [
        t("Links (`<a>`) connect the web. Images (`<img>`) need **src** (where) and **alt** (description)."),
        ex(`<!DOCTYPE html>
<html>
<body>
  <h2>Useful links</h2>
  <p><a href="https://www.wikipedia.org">Wikipedia</a></p>
  <p><a href="https://www.wikipedia.org" target="_blank">Wikipedia (new tab)</a></p>
  <img src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=600&q=60"
       alt="Elephant in the savannah" width="300">
</body>
</html>`),
        list(["`target=\"_blank\"` opens the link in a new tab", "A link can point to another page in your site: `<a href=\"about.html\">About</a>`", "Always write meaningful `alt` text — “Elephant at Amboseli”, not “image1”", "Set `width` (or CSS) so huge photos do not break your layout"]),
        exercise("Write a link with the text “Our Courses” pointing to courses.html in the same folder.", "<a href=\"courses.html\">Our Courses</a>"),
      ]),
      L("html-lists-tables", "HTML Lists & Tables", 9, [
        ex(`<!DOCTYPE html>
<html>
<body>
  <h2>Shopping list</h2>
  <ul>
    <li>Unga (flour)</li>
    <li>Sukuma wiki</li>
    <li>Milk</li>
  </ul>
  <h2>How to register</h2>
  <ol>
    <li>Fill the form</li>
    <li>Pay via M-Pesa</li>
    <li>Receive confirmation</li>
  </ol>
  <table border="1">
    <tr><th>County</th><th>Capital</th></tr>
    <tr><td>Nakuru</td><td>Nakuru City</td></tr>
    <tr><td>Mombasa</td><td>Mombasa</td></tr>
  </table>
</body>
</html>`),
        list(["`<ul>` = unordered (bullets); `<ol>` = ordered (numbers); `<li>` = each item", "Tables: `<table>` → rows `<tr>` → headings `<th>` and data `<td>`", "In modern pages the visible styling of tables is done with CSS — `border` here is just for quick demos"]),
        exercise("Which list type suits exam instructions that must be followed in order, and why?", "<ol> (ordered list) — the numbers make the sequence explicit."),
      ]),
      L("html-forms", "HTML Forms", 9, [
        t("Forms collect user input: names, emails, choices. The `<form>` element wraps **input** elements, each with a `type`."),
        ex(`<!DOCTYPE html>
<html>
<body>
  <h2>Join our class</h2>
  <form>
    <label>Full name:
      <input type="text" placeholder="e.g. Achieng Otieno" required>
    </label><br><br>
    <label>Email:
      <input type="email" placeholder="you@example.co.ke">
    </label><br><br>
    <label>Course:
      <select>
        <option>Excel Basics</option>
        <option>HTML Basics</option>
      </select>
    </label><br><br>
    <button type="submit">Register</button>
  </form>
</body>
</html>`),
        table(["Input type", "Use"], [
          ["text / email / password", "Single-line typing (email & password get browser checks/masking)"],
          ["number / date", "Numbers and calendar pickers"],
          ["radio", "Pick ONE option"],
          ["checkbox", "Pick MANY options"],
          ["<select>", "Dropdown list"],
          ["<textarea>", "Long messages"],
        ]),
        note("A form alone cannot save data — sending it somewhere needs a server or a service. Structure first; plumbing later."),
        exercise("Learners must choose exactly one exam centre from three. Radio buttons or checkboxes?", "Radio buttons — they enforce exactly one choice in the group."),
      ]),
      L("html-semantic", "HTML Semantic Elements", 7, [
        t("**Semantic** elements describe their meaning: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`. They make pages accessible and easier to maintain than endless `<div>`s."),
        ex(`<!DOCTYPE html>
<html>
<body>
  <header><h1>EDVORA Canteen</h1></header>
  <nav><a href="#">Menu</a> | <a href="#">Prices</a></nav>
  <main>
    <section>
      <h2>Today's Special</h2>
      <p>Ugali, sukuma wiki and beef — KSh 250.</p>
    </section>
  </main>
  <footer><small>Open Mon–Sat, 7am–8pm</small></footer>
</body>
</html>`),
        tip("Screen readers announce landmarks like nav and main, letting visually-impaired users jump around quickly. Semantics are kindness written in code."),
        exercise("Which element should wrap the main unique content of a page, appearing only once?", "<main> — exactly one per page."),
      ]),
    ]),
    S("html-web-foundations-s2", "CSS Basics", [
      L("css-intro", "CSS Introduction", 8, [
        t("**CSS** (Cascading Style Sheets) controls how HTML *looks*: colours, sizes, spacing and layout. HTML is the skeleton; CSS is the clothing."),
        h("CSS syntax"),
        code("selector { property: value; }\n\np { color: blue; font-size: 18px; }", "css"),
        h("Three ways to add CSS"),
        table(["Way", "Where", "Best for"], [
          ["Inline", "`style=\"…\"` inside a tag", "One-off tweaks"],
          ["Internal", "`<style>` in the <head>", "Single pages & learning"],
          ["External", "A separate .css file", "Whole websites (the professional way)"],
        ]),
        ex(`<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: Arial, sans-serif; }
  h1 { color: #2563eb; }
  p { color: #333; line-height: 1.6; }
</style>
</head>
<body>
  <h1>Styled heading</h1>
  <p>Change the colour codes above and run again!</p>
</body>
</html>`),
        exercise("Write one CSS rule that makes every <h2> green.", "h2 { color: green; } — selector h2, property color, value green."),
      ]),
      L("css-selectors", "CSS Selectors & Colours", 8, [
        table(["Selector", "Selects", "Example"], [
          ["Element", "Every tag of a type", "`p { … }`"],
          ["Class `.name`", "Elements with that class (many)", "`.price { … }`"],
          ["ID `#name`", "The one element with that id", "`#header { … }`"],
        ]),
        h("Ways to write colours"),
        list(["Named: `red`, `navy`, `forestgreen`", "HEX: `#2563eb` (red-green-blue in hexadecimal)", "RGB: `rgb(37, 99, 235)`; add transparency with `rgba(37,99,235,0.5)`"]),
        ex(`<!DOCTYPE html>
<html>
<head>
<style>
  .price { color: #047857; font-weight: bold; font-size: 22px; }
  #offer { background: #fef3c7; padding: 10px; }
</style>
</head>
<body>
  <p>Maize flour 2kg — <span class="price">KSh 210</span></p>
  <p id="offer">Weekend offer: free delivery in town!</p>
</body>
</html>`),
        exercise("Five product prices need the same style. Class or ID — and why?", "A class (.price) — classes can repeat on many elements; an ID must be unique per page."),
      ]),
      L("css-box-flex", "CSS Box Model & Flex Layout", 9, [
        t("Every element is a box: **content** in the middle, then **padding** (space inside), **border**, and **margin** (space outside). Total size = all four together."),
        code(".card {\n  padding: 16px;   /* inside space */\n  border: 1px solid #ddd;\n  margin: 12px;    /* outside space */\n}", "css"),
        h("Flexbox: boxes in a row (or column)"),
        ex(`<!DOCTYPE html>
<html>
<head>
<style>
  .row { display: flex; gap: 12px; }
  .card { flex: 1; background: #eef2ff; border: 1px solid #c7d2fe;
          border-radius: 12px; padding: 14px; text-align: center; }
</style>
</head>
<body>
  <div class="row">
    <div class="card">HTML</div>
    <div class="card">CSS</div>
    <div class="card">JavaScript</div>
  </div>
</body>
</html>`),
        list(["`display:flex` on the parent lines children up in a row", "`gap` controls spacing between them; `flex:1` shares width equally", "`border-radius` rounds corners — instant modern look"]),
        tip("Add `flex-wrap: wrap` to .row and shrink the result width: cards stack neatly on narrow phone screens. That is responsive design in one line."),
        exercise("In the box model, which space is *inside* the border: margin or padding?", "Padding. Margin is the space outside the border, separating this box from its neighbours."),
      ]),
    ]),
    S("html-web-foundations-s3", "JavaScript Basics", [
      L("js-intro", "JavaScript Introduction", 8, [
        t("**JavaScript** makes pages *do* things: respond to clicks, calculate, show and hide content. It runs in the browser, inside `<script>` tags."),
        ex(`<!DOCTYPE html>
<html>
<body>
  <h2 id="msg">Habari! Click the button.</h2>
  <button onclick="document.getElementById('msg').innerHTML = 'Karibu EDVORA — you just ran JavaScript!'">
    Click me
  </button>
</body>
</html>`),
        list(["`document.getElementById('msg')` finds the element with id **msg**", "`.innerHTML = '…'` replaces its content", "`onclick` runs code when the element is clicked"]),
        note("JavaScript is not Java — confusing names, different languages. JavaScript is the language of the browser."),
        exercise("In the example, what must the heading's id be for the button to work, and where is it written?", "id=\"msg\" — written as an attribute in the <h2> tag, matching getElementById('msg')."),
      ]),
      L("js-variables-events", "JS Variables, Functions & Events", 9, [
        t("**Variables** store values with `let` (can change) or `const` (fixed). **Functions** package steps you can reuse; **events** (like clicks) trigger them."),
        ex(`<!DOCTYPE html>
<html>
<body>
  <h2>Bus fare calculator</h2>
  <p>Trips: <input id="trips" type="number" value="2"></p>
  <button onclick="calc()">Calculate weekly fare</button>
  <p id="out"></p>
  <script>
    function calc() {
      const farePerTrip = 80;              // KSh, fixed
      let tripsPerDay = Number(document.getElementById('trips').value);
      let weekly = farePerTrip * tripsPerDay * 5;
      document.getElementById('out').innerHTML =
        'Weekly fare (5 days): KSh ' + weekly;
    }
  </script>
</body>
</html>`),
        list(["`Number(...)` converts the input text into a number before maths", "Functions run only when called — here, by the button's `onclick`", "Change 80 to your real fare and try different trips"]),
        exercise("Why must the input value pass through Number() before multiplying?", "Input values arrive as text. Without conversion, “2” might concatenate instead of calculating. Number() makes arithmetic reliable."),
      ]),
    ]),
  ],
});

export const webQuizzes: Quiz[] = [
  {
    id: "q_html", courseId: "html-web-foundations", title: "HTML Basics Quiz", timeLimitMin: 10, maxAttempts: 3, passMark: 60,
    questions: [
      { id: "hq1", type: "mcq", prompt: "What does HTML stand for?", options: ["HyperText Markup Language", "HighText Machine Language", "Hyperlink Text Mode Language", "Home Tool Markup Language"], answer: "HyperText Markup Language", explanation: "HTML = HyperText Markup Language." },
      { id: "hq2", type: "mcq", prompt: "Which tag creates a link?", options: ["<link>", "<a>", "<href>", "<url>"], answer: "<a>", explanation: "The anchor tag <a> with an href attribute creates links." },
      { id: "hq3", type: "mcq", prompt: "Which is the largest heading?", options: ["<h6>", "<heading>", "<h1>", "<head>"], answer: "<h1>", explanation: "<h1> is the most important/largest heading." },
      { id: "hq4", type: "tf", prompt: "The <img> element needs a closing </img> tag.", options: ["True", "False"], answer: "False", explanation: "<img> is a void (empty) element with no closing tag." },
      { id: "hq5", type: "mcq", prompt: "In CSS, which selector targets class=\"price\"?", options: ["#price", ".price", "price", "*price"], answer: ".price", explanation: "A dot prefix selects classes; # selects IDs." },
      { id: "hq6", type: "short", prompt: "In one sentence: what is the difference between HTML, CSS and JavaScript?", answer: "", explanation: "HTML structures content, CSS styles it, JavaScript adds behaviour/interactivity." },
    ],
  },
];

export const webAssignments: Assignment[] = [
  { id: "a_html_county", courseId: "html-web-foundations", title: "Build a Web Page About Your County", instructions: "Using the tutorial lessons, write one HTML page about your home county (or town) containing: an <h1> title, at least two <h2> sections, one image with good alt text, one list (famous places/foods), one small table (e.g. towns & populations or markets & days), one external link, internal CSS styling, and one JavaScript button that changes some text. Paste your full HTML code as your submission.", dueDate: "2026-12-20", maxScore: 100 },
];
