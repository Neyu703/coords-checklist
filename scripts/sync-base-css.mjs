import { copyFileSync } from "node:fs";

// No build step here: copy the shared stylesheet next to index.html so Pages serves it
copyFileSync("node_modules/@neyu703/base-css/base.css", "base.css");
