import type { Assignment, Course, Quiz } from "../db";
import { L, S, t, h, code, tip, note, warn, list, steps, table, exercise, tutorialCourse } from "./shared";

/* ================= WINDOWS ================= */
export const windowsCourse: Course = tutorialCourse({
  id: "windows-basics", title: "Windows Basics Tutorial",
  subtitle: "Master your PC step by step — desktop, files, settings and safety",
  description: "A friendly, practical tutorial for anyone using a Windows computer at school, at work or at home. Short lessons, clear steps, shortcut tables and practice exercises — no experience needed.",
  category: "Computer Skills", tutorId: "u_tutor1", image: "photo-1496181133206-80ce9b88a853",
  objectives: ["Navigate the desktop, taskbar and Start menu confidently", "Create, organise, copy and find files and folders", "Use essential keyboard shortcuts", "Connect Wi-Fi and printers, and keep Windows safe"],
  requirements: ["Any Windows 10 or Windows 11 computer", "No previous computer experience required"],
  sections: [
    S("windows-basics-s1", "Getting Started with Windows", [
      L("win-what", "What is Windows?", 6, [
        t("**Windows** is an **operating system** — the main software that runs your computer. It lets you open programs (apps), save files, connect to the internet and control everything you see on the screen."),
        h("What does an operating system do?"),
        list(["Starts the computer and shows the **desktop**", "Runs apps like Word, Excel and your web browser", "Manages your **files and folders**", "Connects hardware: keyboard, mouse, printer, USB drives"]),
        h("Check your Windows version"),
        steps(["Press `Windows key + R` on the keyboard", "Type `winver` and press `Enter`", "A window shows your version — for example **Windows 11** or **Windows 10**"]),
        note("This tutorial works for both Windows 10 and Windows 11. A few buttons sit in slightly different places, but the ideas are the same."),
        exercise("Use `Win + R`, then `winver`, to find your Windows version. Which version do you have?", "The winver window shows it at the top — for example “Windows 11” or “Windows 10”, with a build number below."),
      ], true),
      L("win-desktop", "The Desktop & Taskbar", 7, [
        t("After you sign in, you see the **desktop**. Think of it like the top of your office desk: shortcuts to your most-used items sit on it, and the **taskbar** runs along the bottom of the screen."),
        table(["Part", "What it does"], [
          ["Desktop icons", "Shortcuts to apps, files and folders"],
          ["Start button", "Opens the Start menu (bottom-left or centre)"],
          ["Taskbar", "Shows open apps; you can pin favourites here"],
          ["System tray", "Clock, network, sound and battery (bottom-right)"],
          ["Recycle Bin", "Where deleted files wait before permanent removal"],
        ]),
        h("Pin an app to the taskbar"),
        steps(["Open the Start menu and find the app", "Right-click the app name", "Choose **Pin to taskbar** — its icon now stays on the taskbar"]),
        tip("Press `Windows key + D` at any time to show the desktop instantly. Press it again to bring your windows back."),
        exercise("Pin your web browser to the taskbar, then press `Win + D` twice. What happens?", "The browser icon stays on the taskbar. Win + D hides all windows to show the desktop; pressing again restores them."),
      ]),
      L("win-start", "Start Menu & Searching", 6, [
        t("The **Start menu** is the launch pad for everything: apps, settings, files and power options. The fastest way to find anything in Windows is **search**."),
        steps(["Press the `Windows key` (or click Start)", "Start typing what you want — try `calculator`", "Click the best match, or press `Enter`"]),
        h("Useful things to search for"),
        list(["App names: `word`, `excel`, `chrome`", "Settings: `wifi`, `display`, `sound`", "Files: part of the file name, e.g. `budget`"]),
        tip("You rarely need to hunt through menus. If it exists on the computer, search will find it."),
        exercise("Open the Calculator using only search, without touching the mouse after pressing the Windows key.", "Press Windows key → type “calc” → press Enter. The Calculator opens."),
      ]),
      L("win-mouse-keyboard", "Mouse & Keyboard Skills", 7, [
        t("Small skills, big speed. Master these mouse actions and keyboard shortcuts and every other lesson becomes easier."),
        table(["Action", "How", "Used for"], [
          ["Click", "Left button once", "Select / press buttons"],
          ["Double-click", "Left button twice, quickly", "Open files and folders"],
          ["Right-click", "Right button once", "Open a menu of options"],
          ["Drag", "Hold left button + move", "Move files and windows"],
          ["Scroll", "Mouse wheel", "Move up/down a page"],
        ]),
        table(["Shortcut", "What it does"], [
          ["`Ctrl + C` / `Ctrl + X` / `Ctrl + V`", "Copy / Cut / Paste"],
          ["`Ctrl + Z` / `Ctrl + Y`", "Undo / Redo"],
          ["`Ctrl + A`", "Select all"],
          ["`Alt + Tab`", "Switch between open apps"],
          ["`Windows + E`", "Open File Explorer"],
          ["`Windows + L`", "Lock the computer"],
        ]),
        exercise("Which shortcut locks your computer when you walk away from your desk?", "`Windows + L` — always lock your PC when you leave it, especially in shared offices and cyber cafés."),
      ]),
    ]),
    S("windows-basics-s2", "Files & Folders", [
      L("win-explorer", "File Explorer Tour", 7, [
        t("**File Explorer** is where all your files live. Open it with `Windows + E`. On the left is the **navigation pane**; on the right, the contents of the folder you selected."),
        table(["Location", "What belongs there"], [
          ["Desktop", "Files you want within quick reach"],
          ["Documents", "Word documents, letters, CVs"],
          ["Downloads", "Files saved from the internet"],
          ["Pictures", "Photos and images"],
          ["This PC", "All drives: C:, USB drives, memory cards"],
        ]),
        h("Change how files are displayed"),
        steps(["Open any folder", "Click the **View** menu (top of the window)", "Try **Large icons** for photos, or **Details** to see size and date"]),
        tip("In Details view, click a column heading like **Date modified** to sort. Click again to reverse the order — very handy for finding your newest file."),
      ]),
      L("win-folders", "Creating & Organising Folders", 8, [
        t("Good folders save you hours. Create a folder for each subject, project or client — for example `School`, `Business Receipts`, `Family Photos 2026`."),
        steps(["Open the location, e.g. **Documents**", "Right-click empty space → **New → Folder** (or press `Ctrl + Shift + N`)", "Type a clear name and press `Enter`"]),
        h("Naming tips"),
        list(["Be specific: `KCSE Revision 2026` beats `Stuff`", "Use dates for records: `Invoices 2026-10`", "Keep names short enough to read at a glance"]),
        exercise("Create a folder inside Documents called `My Practice Files`, then create two sub-folders inside it: `Documents` and `Pictures`.", "Documents → Ctrl+Shift+N → “My Practice Files” → open it → create the two sub-folders the same way."),
      ]),
      L("win-copy-move", "Copy, Move, Rename & Delete", 8, [
        t("**Copy** keeps the original and makes a duplicate. **Move** (cut + paste) relocates the file. Both use the clipboard."),
        steps(["Select the file (click it once)", "Press `Ctrl + C` to copy — or `Ctrl + X` to cut/move", "Open the destination folder", "Press `Ctrl + V` to paste"]),
        h("Rename and delete"),
        list(["Rename: select the file and press `F2`, type the new name, `Enter`", "Delete: select and press `Delete` — the file goes to the **Recycle Bin**", "Restore: open Recycle Bin → right-click the file → **Restore**", "Permanent delete: `Shift + Delete` (cannot be undone — be careful!)"]),
        warn("Files deleted from a **USB drive** do not go to the Recycle Bin — they are removed immediately."),
        exercise("A file was deleted by mistake an hour ago. Where do you look first, and how do you get it back?", "Open the Recycle Bin on the desktop, right-click the file and choose Restore. It returns to its original folder."),
      ]),
      L("win-filetypes", "File Types & Extensions", 6, [
        t("The letters after the dot in a file name — the **extension** — tell Windows what kind of file it is and which app should open it."),
        table(["Extension", "Type", "Opens with"], [
          [".docx", "Word document", "Microsoft Word"],
          [".xlsx", "Excel workbook", "Microsoft Excel"],
          [".pptx", "Presentation", "Microsoft PowerPoint"],
          [".pdf", "Portable document", "Browser / PDF reader"],
          [".jpg / .png", "Picture", "Photos app"],
          [".mp3 / .mp4", "Audio / Video", "Media Player / VLC"],
          [".zip", "Compressed folder", "File Explorer (extract)"],
          [".exe", "Program / installer", "Runs an application"],
        ]),
        warn("Never open an unexpected `.exe` file sent by email or WhatsApp — it may install harmful software. When in doubt, delete it."),
        exercise("You receive `Fees Structure.pdf` and `photo.JPG`. Which apps open each?", "The PDF opens in a browser/PDF reader; the JPG opens in the Photos app (double-click either file)."),
      ]),
      L("win-usb", "USB Drives & Safe Removal", 6, [
        t("Flash disks and memory cards appear as a new drive in **This PC** when plugged in."),
        steps(["Insert the USB drive", "Open File Explorer → **This PC** → double-click the drive (often `E:` or `F:`)", "Copy files to or from it like any folder", "When finished, click the **Safely Remove Hardware** icon near the clock → **Eject**", "Wait for “Safe to remove” before pulling it out"]),
        warn("Pulling a drive out while files are copying can corrupt the files. Always eject first."),
        exercise("Why should you eject a flash disk instead of just pulling it out?", "Windows may still be writing data. Ejecting finishes all writes first, protecting your files from corruption."),
      ]),
    ]),
    S("windows-basics-s3", "Settings & Safety", [
      L("win-settings", "Important Settings", 7, [
        t("Open Settings with `Windows + I`. These are the areas beginners use most."),
        table(["Setting", "Where", "What you can change"], [
          ["Display", "System → Display", "Brightness, text size, resolution"],
          ["Sound", "System → Sound", "Volume, speakers/headphones"],
          ["Apps", "Apps → Installed apps", "Uninstall programs you no longer need"],
          ["Personalisation", "Personalisation", "Wallpaper, colours, lock screen"],
          ["Time & language", "Time & language", "Date, time zone (East Africa Time), keyboard"],
        ]),
        tip("Text too small? System → Display → **Scale** → choose 125%. Everything becomes easier to read."),
        exercise("Your screen looks dim in bright sunlight. Which setting do you adjust?", "System → Display → Brightness slider (on laptops). You can also use the brightness keys on the keyboard, often Fn + an F-key with a sun icon."),
      ]),
      L("win-wifi-print", "Wi-Fi & Printers", 7, [
        h("Connect to Wi-Fi"),
        steps(["Click the **network icon** near the clock (bottom-right)", "Turn Wi-Fi **On** and pick your network name", "Enter the password and click **Connect**"]),
        h("Add a printer"),
        steps(["Switch the printer on and connect it (USB or same Wi-Fi)", "Settings → **Bluetooth & devices → Printers & scanners**", "Click **Add device**, select your printer, then print a test page"]),
        note("In many Kenyan offices and cyber cafés the printer is shared on the network — ask for its name, then add it the same way."),
        exercise("A document will not print. List three quick checks before calling for help.", "1) Printer is on and has paper. 2) You selected the correct printer in the print window. 3) The PC is connected (USB plugged in / same Wi-Fi) and the printer is not paused or “offline”."),
      ]),
      L("win-safety", "Keeping Windows Safe & Updated", 8, [
        list(["**Update Windows**: Settings → Windows Update → Check for updates. Updates fix security holes.", "**Use the built-in antivirus**: Windows Security runs automatically — keep it on.", "**Strong password + lock**: use a password only you know, and press `Win + L` when you step away.", "**Think before you click**: unexpected email/WhatsApp attachments and “you have won!” links are classic scams.", "**Back up important files**: copy them to a second place — a flash disk, external drive or cloud storage."]),
        warn("No genuine message from a bank, M-Pesa or Microsoft will ever ask for your PIN or password. Anyone asking is trying to steal from you."),
        exercise("Why is one copy of an important file not a backup?", "If that single copy is lost (theft, damage, accidental delete, virus), the file is gone. A backup means the file exists in at least two different places."),
      ]),
    ]),
  ],
});

/* ================= MICROSOFT WORD ================= */
export const wordCourse: Course = tutorialCourse({
  id: "ms-word", title: "Microsoft Word Tutorial",
  subtitle: "Create polished documents — letters, CVs, assignments and reports",
  description: "Learn Microsoft Word the practical way: short notes, exact steps, shortcut tables and exercises. By the end you will format professional documents, build a CV and print or share as PDF.",
  category: "Computer Skills", tutorId: "u_tutor3", image: "photo-1434030216411-0b793f4b4173",
  objectives: ["Create, save and organise Word documents", "Format text and paragraphs professionally", "Use headings, pictures, tables and page numbers", "Check spelling, print and export to PDF"],
  requirements: ["Microsoft Word (desktop or free Word on the web)", "Basic keyboard skills — see our free Windows Basics tutorial first if needed"],
  sections: [
    S("ms-word-s1", "Word Basics", [
      L("word-intro", "Introduction to Microsoft Word", 6, [
        t("**Microsoft Word** is a word processor — software for creating text documents such as letters, CVs, school assignments, meeting minutes and reports."),
        h("The Word window"),
        table(["Part", "What it is"], [
          ["Ribbon", "The toolbar at the top, organised in tabs (Home, Insert, Layout…)"],
          ["Document area", "The white page where you type"],
          ["Ruler", "Shows margins and indents (View tab → Ruler)"],
          ["Status bar", "Bottom bar: page number, word count, language"],
          ["File tab", "New, Open, Save, Print and Share"],
        ]),
        tip("Rest your mouse on any ribbon button for a second — a tooltip explains what it does and shows its shortcut."),
        exercise("Where do you find the word count of your document without opening any menu?", "On the status bar at the bottom-left of the Word window."),
      ], true),
      L("word-create-save", "Creating & Saving Documents", 7, [
        steps(["Open Word → choose **Blank document**", "Type your text", "Press `Ctrl + S` to save", "Choose a folder (e.g. Documents), type a clear file name, click **Save**"]),
        table(["Format", "Use it when"], [
          [".docx", "You will keep editing the document in Word"],
          [".pdf", "Sharing a final version (CV, letter) that should not change"],
        ]),
        h("Save as PDF"),
        steps(["File → **Save As** (or Export)", "Choose **PDF** as the file type", "Save — you now have both the editable .docx and a shareable .pdf"]),
        tip("Save early, save often. Pressing `Ctrl + S` every few minutes protects you from power cuts — a very Kenyan problem!"),
        exercise("You are emailing your CV to an employer. Which format do you attach, and why?", "PDF — it looks the same on every device and cannot be edited accidentally. Keep the .docx for your own future edits."),
      ]),
      L("word-editing", "Typing & Editing Text", 7, [
        t("The blinking line is the **cursor** — text appears where it blinks. Click anywhere to move it, or use the arrow keys."),
        table(["Task", "How"], [
          ["Select a word", "Double-click it"],
          ["Select a paragraph", "Triple-click inside it"],
          ["Select everything", "`Ctrl + A`"],
          ["Undo a mistake", "`Ctrl + Z` (your best friend)"],
          ["Redo", "`Ctrl + Y`"],
          ["Find a word", "`Ctrl + F`, then type"],
          ["Replace everywhere", "`Ctrl + H`"],
        ]),
        note("Made a formatting mess? Select the text and press `Ctrl + Space` to clear direct formatting back to the default style."),
        exercise("You typed a name wrongly 15 times in a report. What is the fastest fix?", "Ctrl + H (Find & Replace): type the wrong spelling in Find, the correct one in Replace, then Replace All."),
      ]),
    ]),
    S("ms-word-s2", "Formatting Like a Pro", [
      L("word-fonts", "Font Formatting", 7, [
        t("Select text first, then format it. The main controls live on the **Home** tab in the Font group."),
        table(["Formatting", "Shortcut", "Good use"], [
          ["**Bold**", "`Ctrl + B`", "Headings, key terms"],
          ["*Italic*", "`Ctrl + I`", "Book titles, gentle emphasis"],
          ["Underline", "`Ctrl + U`", "Use sparingly — often confused with links"],
          ["Font & size", "Home tab dropdowns", "Body text: 11–12 pt; headings larger"],
          ["Text colour", "Home tab → A with colour bar", "Highlights — keep professional documents mostly black"],
        ]),
        tip("Professional documents use one or two fonts only. Calibri or Arial for body text is always safe."),
        exercise("Select the sentence “Fees must be paid by Friday.” Which single shortcut makes it stand out appropriately in a school notice?", "Ctrl + B for bold. Avoid underlining long sentences or using many colours."),
      ]),
      L("word-paragraphs", "Paragraphs, Alignment & Lists", 8, [
        table(["Alignment", "Shortcut", "Effect"], [
          ["Left", "`Ctrl + L`", "Default for most text"],
          ["Centre", "`Ctrl + E`", "Titles and headings on posters"],
          ["Right", "`Ctrl + R`", "Dates on letters"],
          ["Justify", "`Ctrl + J`", "Even edges — common in reports & newspapers"],
        ]),
        h("Bullets and numbering"),
        steps(["Select the lines", "Home tab → **Bullets** (•) for unordered items, or **Numbering** (1. 2. 3.) for steps/order", "Press `Tab` at the start of an item to make it a sub-item"]),
        h("Line spacing"),
        steps(["Select paragraphs", "Home → Line Spacing button → choose **1.5** (common for assignments) or **2.0** when instructed"]),
        exercise("Your tutor asks for a justified, 1.5-spaced essay. Which two controls do you use?", "Ctrl + A (select all) → Ctrl + J (justify) → Line Spacing → 1.5."),
      ]),
      L("word-styles", "Styles & Headings", 8, [
        t("**Styles** are ready-made formatting sets (Heading 1, Heading 2, Normal). Using them keeps big documents consistent — and lets Word build a table of contents automatically."),
        steps(["Click in your main title line", "Home tab → Styles group → **Heading 1**", "Sub-headings get **Heading 2**, body text stays **Normal**"]),
        h("Why styles beat manual bold-and-bigger"),
        list(["Change one style and every heading updates at once", "The **Navigation Pane** (View tab) becomes a clickable outline of your document", "References tab can insert an automatic **Table of Contents**"]),
        exercise("You must produce a table of contents for a 20-page project. What must your chapter titles use so Word can build it automatically?", "Heading styles (Heading 1 for chapters, Heading 2 for sections). Then References → Table of Contents."),
      ]),
    ]),
    S("ms-word-s3", "Layout & Finishing", [
      L("word-pagesetup", "Page Setup: Margins, Orientation & Size", 6, [
        t("Page setup lives on the **Layout** tab and should be chosen **before** heavy formatting."),
        table(["Setting", "Common choices"], [
          ["Size", "**A4** (standard in Kenya), Letter, A5"],
          ["Orientation", "Portrait (tall) or Landscape (wide — for big tables/certificates)"],
          ["Margins", "Normal (2.54 cm) or Narrow to fit more per page"],
        ]),
        tip("Printing a certificate? Choose A4 + Landscape, then centre the text (`Ctrl + E`)."),
        exercise("A wide class mark-sheet table is cut off on the right. Which single page setting fixes it?", "Change Orientation to Landscape on the Layout tab (and/or use Narrow margins)."),
      ]),
      L("word-insert", "Inserting Pictures & Tables", 8, [
        h("Insert a picture"),
        steps(["Click where the picture should go", "Insert tab → **Pictures** → choose the image file", "Drag a **corner** handle to resize without stretching", "Use the Layout Options button beside the picture to wrap text around it"]),
        h("Insert a table"),
        steps(["Insert tab → **Table** → highlight the grid, e.g. 4 columns × 5 rows", "Type into cells; press `Tab` to move to the next cell (Tab in the last cell adds a row)", "Select the first row → make it **bold** so it reads as headings"]),
        warn("Only use pictures you own or have permission to use — especially for business and published work."),
        exercise("In a table, which key moves you to the next cell, and how do you add one more row at the end?", "Tab moves to the next cell; pressing Tab in the very last cell creates a new row."),
      ]),
      L("word-headers", "Headers, Footers & Page Numbers", 7, [
        t("The **header** is the area at the top of every page; the **footer** is at the bottom. They are perfect for document titles and page numbers."),
        steps(["Insert tab → **Header** → Blank; type e.g. your school/business name", "Insert tab → **Page Number** → Bottom of Page → choose a style", "Double-click the body of the page to return to normal editing"]),
        tip("For assignments, put your **name and admission/registration number** in the header — loose pages can then always be re-united."),
        exercise("Page numbers should appear automatically on all 12 pages. Do you type 1–12 manually?", "No. Insert → Page Number once; Word numbers every page automatically and updates if pages move."),
      ]),
      L("word-spell-print", "Spelling Check, Printing & Your CV", 8, [
        steps(["Press `F7` to run **Spelling & Grammar** check; accept or ignore each suggestion", "Read the document once on screen — spellcheck cannot catch every wrong word (e.g. “from” vs “form”)", "Press `Ctrl + P` for Print preview", "Confirm the printer, copies and pages, then **Print**"]),
        h("Final exercise — build a one-page CV"),
        list(["Heading 1: your full name; below it phone, email, county", "Heading 2 sections: **Profile**, **Education**, **Experience**, **Skills**, **Referees**", "Bullet points for responsibilities and skills", "Save as `YourName-CV.docx`, then also Save As PDF"]),
        exercise("Spellcheck shows no errors, yet your letter says “I am writing to apply for the post of a *clack*.” Why did it miss “clerk”?", "“Clack” is itself a real word, so spellcheck accepts it in the sense of validity of spelling — proofreading by a human is still essential."),
      ]),
    ]),
  ],
});

/* ================= MICROSOFT EXCEL ================= */
export const excelCourse: Course = tutorialCourse({
  id: "ms-excel", title: "Microsoft Excel Tutorial",
  subtitle: "From your first cell to formulas, functions and charts",
  description: "Excel made simple and practical: budgets, shop records, class marks and reports. Each lesson gives you the idea, an example you can copy, and a small exercise.",
  category: "Computer Skills", tutorId: "u_tutor2", image: "photo-1543286386-713bdd548da4",
  objectives: ["Enter and format data in worksheets", "Write formulas and use SUM, AVERAGE, IF and more", "Understand cell references ($ signs) properly", "Sort, filter and chart data; print clean reports"],
  requirements: ["Microsoft Excel (desktop or free Excel on the web)", "Basic maths and computer skills"],
  sections: [
    S("ms-excel-s1", "Excel Basics", [
      L("excel-intro", "Introduction to Excel", 7, [
        t("**Excel** is a spreadsheet program for working with numbers and lists: budgets, stock records, marks, sales and timetables."),
        table(["Term", "Meaning"], [
          ["Workbook", "The Excel file (.xlsx)"],
          ["Worksheet (sheet)", "One page of the workbook; tabs at the bottom"],
          ["Column", "Vertical line of cells, labelled A, B, C…"],
          ["Row", "Horizontal line of cells, numbered 1, 2, 3…"],
          ["Cell", "One box, named by column + row — e.g. **B4**"],
          ["Formula bar", "Shows the true contents of the selected cell"],
        ]),
        code("Cell B4  =  column B, row 4", "text"),
        tip("Click any cell — its address appears in the **Name Box** (top-left). This is how you learn to “speak Excel”."),
        exercise("What is the address of the cell in column D, row 7?", "D7 — column letter first, then the row number."),
      ], true),
      L("excel-data", "Entering & Formatting Data", 8, [
        steps(["Click a cell and type — text, a number or a date", "Press `Enter` to move down, `Tab` to move right", "To edit a cell, double-click it or press `F2`"]),
        h("Make numbers meaningful"),
        steps(["Select the cells", "Home tab → Number group: choose **Currency**, **Percentage**, or **Date**", "Use the **,.0** buttons to add/remove decimal places"]),
        h("Quick formatting wins"),
        list(["Bold your heading row and add a fill colour (paint-bucket icon)", "Widen a column: double-click its right border in the letter header", "Freeze headings: View → **Freeze Panes → Freeze Top Row** so titles stay visible while scrolling"]),
        exercise("A column shows `####` instead of numbers. What happened and how do you fix it in two seconds?", "The column is too narrow for the number. Double-click the right border of the column letter to auto-fit its width."),
      ]),
      L("excel-sheets", "Worksheets & Saving", 6, [
        steps(["Add a sheet: click the **+** beside the sheet tabs", "Rename: double-click the tab, type a name like `January Sales`", "Colour a tab: right-click → **Tab Color**", "Move a sheet: drag its tab left/right"]),
        note("One workbook, many sheets: for example one shop workbook with a sheet per month — plus a Summary sheet that adds them up."),
        tip("Save with `Ctrl + S`. Names like `Duka Sales 2026.xlsx` stay findable months later."),
        exercise("How do you rename `Sheet1` to `Class Marks`?", "Double-click the Sheet1 tab at the bottom, type “Class Marks”, press Enter."),
      ]),
    ]),
    S("ms-excel-s2", "Formulas & Functions", [
      L("excel-formulas", "Your First Formulas", 8, [
        t("Every formula starts with **=**. Formulas use **cell references** (like B2) so results update automatically when numbers change."),
        code("=B2*C2        quantity × price\n=D2+D3+D4     add three cells\n=B5-(B5*0.16) price less 16%\n=A2&B2         join text (rare for beginners)", "excel"),
        steps(["Click the result cell", "Type `=`, click the first cell (Excel types its address for you!)", "Type the operator `+  -  *  /`, click the next cell", "Press `Enter` — the answer appears; the formula bar shows the formula"]),
        h("Copy a formula down"),
        steps(["Select the cell with the formula", "Drag the small square (**fill handle**) at its bottom-right corner down the column", "Excel adjusts the row numbers for each row — this is the magic of relative references"]),
        exercise("B2 is quantity 5, C2 is price 200. Write the formula for the total in D2.", "=B2*C2 — giving 1000. Never type =5*200; references keep the sheet alive when values change."),
      ]),
      L("excel-functions", "SUM, AVERAGE, MAX, MIN, COUNT", 8, [
        t("**Functions** are ready-made calculations. These five handle most everyday work."),
        table(["Function", "Example", "Result"], [
          ["SUM", "`=SUM(B2:B31)`", "Total of B2 to B31"],
          ["AVERAGE", "`=AVERAGE(C2:C40)`", "Mean mark of a class"],
          ["MAX / MIN", "`=MAX(D2:D40)`", "Highest / lowest value"],
          ["COUNT", "`=COUNT(B2:B40)`", "How many numbers (e.g. learners who sat the exam)"],
          ["COUNTA", "`=COUNTA(A2:A40)`", "How many non-empty cells (e.g. names present)"],
        ]),
        code("Daily sales in B2:B8 →  weekly total:  =SUM(B2:B8)\nMean score in C2:C41 →  class average: =AVERAGE(C2:C41)", "excel"),
        tip("Select numbers and glance at the status bar (bottom) — Excel shows Average, Count and Sum instantly without any formula."),
        exercise("Marks are in D2:D51. Write formulas for (a) the top mark (b) how many learners sat the exam.", "(a) =MAX(D2:D51)  (b) =COUNT(D2:D51)"),
      ]),
      L("excel-refs", "Relative vs Absolute References ($)", 8, [
        t("When you copy `=B2*C2` down, it becomes `=B3*C3`, `=B4*C4`… — that is **relative** referencing, and usually perfect."),
        t("But sometimes one cell must **stay fixed** — for example a VAT rate in H1 used by every row. Lock it with **$ signs**: `$H$1`."),
        code("Price in C2, VAT rate in $H$1:\n=C2*$H$1        copied down, H1 never moves\n\n$C2   column locked, row free\nC$2   row locked, column free\n$C$2  both locked", "excel"),
        tip("Click a reference in the formula bar and press `F4` to cycle through the $ combinations."),
        exercise("Your commission rate sits in F1. In D2 you calculate pay × rate, to copy down 50 rows. Write D2 if pay is in C2.", "=C2*$F$1 — C2 moves as you copy down; $F$1 stays fixed on the rate."),
      ]),
      L("excel-if", "The IF Function", 9, [
        t("**IF** lets Excel decide: *if a condition is true, show one value, otherwise show another.*"),
        code('=IF(condition, value_if_true, value_if_false)\n\n=IF(C2>=50,"Pass","Fail")\n=IF(B2>10000,"Bonus","No bonus")', "excel"),
        h("Grade a class automatically"),
        steps(["Marks in C2:C41, pass mark 50", "In D2 type `=IF(C2>=50,\"Pass\",\"Fail\")`", "Fill down — every learner is graded instantly"]),
        note("Text answers inside formulas must wear **quotation marks** — `\"Pass\"`, not `Pass`. Numbers do not need quotes."),
        exercise("Stock in B2; warn when below 10. Write the formula for C2 showing “Reorder” or “OK”.", "=IF(B2<10,\"Reorder\",\"OK\")"),
      ]),
    ]),
    S("ms-excel-s3", "Working with Data", [
      L("excel-sort-filter", "Sorting & Filtering", 7, [
        steps(["Click any cell inside your table", "Data tab → **Sort**: choose the column (e.g. Total Marks, largest first) — whole rows move together, so names stay with their marks", "Data tab → **Filter**: dropdown arrows appear; untick values to hide rows temporarily"]),
        warn("Never sort a **single column** on its own when asked “expand the selection?” — always expand, or names and marks will be scrambled."),
        exercise("You need only the learners from “Form 2 East” visible, without deleting others. Which tool?", "Filter: Data → Filter → in the Class column dropdown, keep only “Form 2 East” ticked. Clear the filter to see everyone again."),
      ]),
      L("excel-charts", "Charts", 8, [
        table(["Chart", "Best for"], [
          ["Column", "Comparing amounts (sales per month)"],
          ["Line", "Trends over time (fees collected per term)"],
          ["Pie", "Shares of a whole (budget split) — max ~6 slices"],
        ]),
        steps(["Select your labels **and** numbers (including headings)", "Insert tab → choose the chart type", "Click the chart title and give it a clear name, e.g. **Monthly Sales 2026 (KSh)**", "Use Chart Design tab to add data labels if needed"]),
        tip("A chart title should answer: **what**, **where/when**, and **units** — “Duka Sales, Jan–Jun 2026 (KSh)” beats “Chart Title”."),
        exercise("Which chart shows how a school budget is divided between salaries, food, books and transport?", "A pie chart — each slice is a share of the whole budget."),
      ]),
      L("excel-print", "Printing & Page Setup", 6, [
        steps(["Select the exact range to print → Page Layout → **Print Area → Set Print Area**", "Page Layout → **Orientation: Landscape** for wide tables; **Size: A4**", "Page Layout → **Fit Sheet on One Page** (Width: 1) so nothing spills", "`Ctrl + P` to preview before wasting paper"]),
        h("Repeat headings on every printed page"),
        steps(["Page Layout → **Print Titles**", "Rows to repeat at top: select your heading row, e.g. `$1:$1`", "Now every printed page carries the column titles"]),
        exercise("A 3-page mark sheet prints headings only on page 1. Which setting fixes pages 2–3?", "Print Titles → “Rows to repeat at top” set to your heading row."),
      ]),
    ]),
  ],
});

/* ================= MICROSOFT POWERPOINT ================= */
export const powerpointCourse: Course = tutorialCourse({
  id: "ms-powerpoint", title: "Microsoft PowerPoint Tutorial",
  subtitle: "Design clean slides and present with confidence",
  description: "From blank presentation to confident delivery: layouts, themes, pictures, sensible animation, speaker notes and slideshow control shortcuts.",
  category: "Computer Skills", tutorId: "u_tutor1", image: "photo-1540575467063-178a50c2df87",
  objectives: ["Build presentations with proper slide layouts", "Apply themes and design rules that stay readable", "Add pictures, shapes, transitions and animations wisely", "Present smoothly with notes and shortcuts; export to PDF/video"],
  requirements: ["Microsoft PowerPoint (desktop or free on the web)"],
  sections: [
    S("ms-powerpoint-s1", "PowerPoint Basics", [
      L("ppt-intro", "Introduction to PowerPoint", 6, [
        t("**PowerPoint** creates **slideshows**: a series of slides that support a talk — a lesson, a pitch to customers, a church or chama report, a project defence."),
        table(["Part", "Purpose"], [
          ["Slide pane (left)", "Thumbnails of all slides; click to jump, drag to reorder"],
          ["Slide canvas (centre)", "The slide you are editing"],
          ["Notes pane (below)", "Your private speaking notes — the audience never sees these"],
          ["Ribbon", "Home (text), Insert (media), Design (look), Transitions & Animations (movement)"],
        ]),
        note("Slides support your words — they are not a document to be read aloud. Keep that in mind from slide one."),
        exercise("Where do you write reminders that only you should see while presenting?", "In the Notes pane below each slide — visible to you in Presenter View, invisible to the audience."),
      ], true),
      L("ppt-layouts", "Creating Slides & Layouts", 7, [
        steps(["Home tab → **New Slide** dropdown → pick a layout (Title Slide, Title & Content, Two Content, Blank…)", "Click each **placeholder** (“Click to add title”) and type", "Change a slide later: Home → **Layout** → choose another arrangement"]),
        h("The golden rules of slide text"),
        list(["**One idea per slide**", "Short phrases, not full sentences — you supply the explanation", "Generous font: titles 32pt+, body 24pt+ so the back row can read", "Maximum ~6 lines per slide"]),
        exercise("A slide contains 14 lines of small text copied from a handout. What two changes fix it?", "Split it into 2–3 slides of short phrases and increase the font size (24pt+). Details belong in your spoken words or the handout."),
      ]),
    ]),
    S("ms-powerpoint-s2", "Design & Media", [
      L("ppt-themes", "Themes & Slide Design", 7, [
        steps(["Design tab → browse **Themes**; one click recolours and re-fonts the whole deck consistently", "Use a **dark text on light background** (or the reverse) — contrast is readability", "Stick to the theme's colours instead of picking random ones per slide"]),
        tip("Presenting in a bright room or on an old projector? Light background with near-black text survives best."),
        exercise("Your title is yellow text on a white background. What is wrong and what is the fix?", "Contrast is too low to read, especially projected. Use a dark colour (e.g. navy/black) on white, or white text on a dark background."),
      ]),
      L("ppt-media", "Pictures, Shapes & Icons", 7, [
        steps(["Insert → **Pictures** → choose image; drag **corner** handles to resize proportionally", "Insert → **Shapes** for arrows, banners and callouts; hold `Shift` while drawing for perfect squares/circles", "Select a picture → Picture Format → **Crop** to trim edges; add **Alt Text** for accessibility (right-click)"]),
        warn("Do not stretch photos by dragging side handles — squashed faces look unprofessional instantly."),
        exercise("A photo looks wide and distorted after resizing. How should you have resized it?", "Drag a corner handle (keeps proportions), or undo (Ctrl+Z) and crop instead."),
      ]),
      L("ppt-animation", "Transitions & Animations", 7, [
        table(["", "Transitions", "Animations"], [
          ["Applies to", "Moving **between slides**", "Objects **on a slide**"],
          ["Tab", "Transitions", "Animations"],
          ["Sensible choice", "Fade / Morph", "Appear / Fade, one click per bullet"],
        ]),
        steps(["Transitions tab → **Fade** → **Apply To All** for consistency", "To reveal bullets one by one: select the text box → Animations → **Appear** (grouped by paragraph by default)"]),
        tip("Animation should serve the story, never become the story. If the audience remembers your spinning text, they missed your message."),
        exercise("What is the difference between a transition and an animation?", "A transition is how one slide changes to the next; an animation moves/reveals objects (text, pictures) within a single slide."),
      ]),
    ]),
    S("ms-powerpoint-s3", "Presenting", [
      L("ppt-notes", "Speaker Notes & Rehearsing", 6, [
        steps(["Click **Notes** below a slide and type your talking points — short prompts, key figures, a story to tell", "Slide Show tab → **Rehearse Timings** to practise against the clock", "With a second screen/projector, **Presenter View** shows your notes + next slide privately"]),
        tip("Note the **one number** the audience must remember per slide. If you lose your place, that number restarts you."),
        exercise("During the talk you forget a statistic. Where should it have been written so only you see it?", "In that slide's Notes pane, read from Presenter View."),
      ]),
      L("ppt-present", "Running the Slideshow", 7, [
        table(["Key", "Action"], [
          ["`F5`", "Start from the beginning"],
          ["`Shift + F5`", "Start from the current slide"],
          ["`Space / → / N`", "Next slide or animation step"],
          ["`← / P`", "Previous"],
          ["`B` / `W`", "Black / White screen (pause attention on you)"],
          ["Number + `Enter`", "Jump to that slide number"],
          ["`Esc`", "End the show"],
        ]),
        tip("Arrive early: test the projector, font sizes from the back row, and your clicker/phone hotspot **before** the audience settles."),
        exercise("Mid-talk, someone asks about slide 3 while you are on slide 9. Fastest way there?", "Type 3 and press Enter — the show jumps straight to slide 3."),
      ]),
      L("ppt-share", "Saving, Sharing & Exporting", 6, [
        steps(["Keep the editable master: **Save As → .pptx**", "For sharing where PowerPoint may be missing: File → Export → **Create PDF**", "For WhatsApp-friendly sharing or YouTube: File → Export → **Create a Video** (narrate with Record first if needed)"]),
        note("Fonts can change on another computer. For critical presentations, carry the PDF as a backup — it looks identical everywhere."),
        exercise("The venue laptop has no PowerPoint. Which two exports save your presentation?", "PDF (slides as pages, any device) or Video (plays anywhere, keeps timings/voice). Carry one of them as backup."),
      ]),
    ]),
  ],
});

export const officeCourses: Course[] = [windowsCourse, wordCourse, excelCourse, powerpointCourse];

export const officeQuizzes: Quiz[] = [
  {
    id: "q_windows", courseId: "windows-basics", title: "Windows Basics Quiz", timeLimitMin: 8, maxAttempts: 3, passMark: 60,
    questions: [
      { id: "wq1", type: "mcq", prompt: "Which shortcut locks your computer?", options: ["Win + D", "Win + L", "Ctrl + L", "Alt + F4"], answer: "Win + L", explanation: "Windows key + L locks the PC instantly." },
      { id: "wq2", type: "mcq", prompt: "A file deleted from the hard disk first goes to…", options: ["Downloads", "The Recycle Bin", "Documents", "It is gone forever"], answer: "The Recycle Bin", explanation: "It waits in the Recycle Bin until emptied (USB deletions are the exception)." },
      { id: "wq3", type: "tf", prompt: "You should always eject a USB drive before removing it.", options: ["True", "False"], answer: "True", explanation: "Ejecting finishes all writes and protects files from corruption." },
      { id: "wq4", type: "mcq", prompt: "Which file extension is a program/installer you should treat with caution?", options: [".pdf", ".jpg", ".exe", ".docx"], answer: ".exe", explanation: ".exe files run software — never open unexpected ones." },
    ],
  },
  {
    id: "q_word", courseId: "ms-word", title: "Microsoft Word Quiz", timeLimitMin: 8, maxAttempts: 3, passMark: 60,
    questions: [
      { id: "dq1", type: "mcq", prompt: "Which shortcut saves your document?", options: ["Ctrl + P", "Ctrl + S", "Ctrl + N", "F7"], answer: "Ctrl + S", explanation: "Ctrl + S saves; do it every few minutes." },
      { id: "dq2", type: "mcq", prompt: "Why use Heading styles instead of just making text bold and bigger?", options: ["They print faster", "They enable the Navigation Pane and automatic Table of Contents", "They use less ink", "They lock the document"], answer: "They enable the Navigation Pane and automatic Table of Contents", explanation: "Styles create document structure Word can navigate and summarise." },
      { id: "dq3", type: "tf", prompt: "PDF is the better format when emailing a final CV.", options: ["True", "False"], answer: "True", explanation: "PDF looks identical everywhere and resists accidental edits." },
      { id: "dq4", type: "mcq", prompt: "Which key starts the spelling & grammar check?", options: ["F1", "F5", "F7", "F12"], answer: "F7", explanation: "F7 runs the Editor/spell check in Word." },
    ],
  },
  {
    id: "q_excel", courseId: "ms-excel", title: "Microsoft Excel Quiz", timeLimitMin: 10, maxAttempts: 3, passMark: 60,
    questions: [
      { id: "eq1", type: "mcq", prompt: "Every Excel formula begins with…", options: ["+", "=", "#", "@"], answer: "=", explanation: "The equals sign tells Excel to calculate." },
      { id: "eq2", type: "mcq", prompt: "Which formula totals B2 to B31?", options: ["=SUM(B2:B31)", "=ADD(B2-B31)", "=B2+B31", "SUM B2:B31"], answer: "=SUM(B2:B31)", explanation: "SUM with a colon range adds every cell between." },
      { id: "eq3", type: "mcq", prompt: "In =$F$1, the dollar signs mean…", options: ["Currency formatting", "The reference stays fixed when copied", "An error", "The cell is protected"], answer: "The reference stays fixed when copied", explanation: "$ locks the column and/or row (absolute reference)." },
      { id: "eq4", type: "mcq", prompt: "=IF(C2>=50,\"Pass\",\"Fail\") shows “Pass” when…", options: ["C2 is empty", "C2 is exactly 49", "C2 is 50 or more", "Always"], answer: "C2 is 50 or more", explanation: ">= means greater than or equal to." },
      { id: "eq5", type: "tf", prompt: "When sorting, you should let Excel expand the selection so rows stay together.", options: ["True", "False"], answer: "True", explanation: "Sorting one column alone scrambles names away from their data." },
    ],
  },
  {
    id: "q_ppt", courseId: "ms-powerpoint", title: "Microsoft PowerPoint Quiz", timeLimitMin: 8, maxAttempts: 3, passMark: 60,
    questions: [
      { id: "pq1", type: "mcq", prompt: "A transition controls…", options: ["Text on one slide", "Movement between slides", "Slide size", "Speaker notes"], answer: "Movement between slides", explanation: "Transitions are between slides; animations are within a slide." },
      { id: "pq2", type: "mcq", prompt: "Which key starts the slideshow from the beginning?", options: ["F1", "F5", "F7", "Esc"], answer: "F5", explanation: "F5 starts; Shift+F5 starts from the current slide." },
      { id: "pq3", type: "tf", prompt: "Speaker notes are visible to the audience on the main screen.", options: ["True", "False"], answer: "False", explanation: "Notes appear only in Presenter View on your screen." },
      { id: "pq4", type: "mcq", prompt: "Best minimum body-text size for readable slides?", options: ["10pt", "14pt", "24pt", "8pt"], answer: "24pt", explanation: "24pt+ keeps the back row reading comfortably." },
    ],
  },
];

export const officeAssignments: Assignment[] = [
  { id: "a_word_cv", courseId: "ms-word", title: "Create Your One-Page CV", instructions: "Following the lessons, build a one-page CV in Word: Heading 1 name, Heading 2 sections (Profile, Education, Experience, Skills, Referees), bullet points, then Save As PDF. In your submission, describe your sections and paste your Profile paragraph.", dueDate: "2026-12-15", maxScore: 100 },
  { id: "a_excel_budget", courseId: "ms-excel", title: "Monthly Budget Sheet", instructions: "Create a monthly budget in Excel with at least 8 expense items. Use SUM for the total, an IF formula that shows “Over budget” when spending passes your income, and a column chart. In your submission, list your items and paste the two formulas you used.", dueDate: "2026-12-15", maxScore: 100 },
];
