# Run Zero Zero locally

## Quick start

1. **Open Terminal** and go to the project folder:
   ```bash
   cd "/Users/lomi_02/Library/Mobile Documents/com~apple~CloudDocs/Documents/Documents - Gary's MacBook Air/00-00"
   ```

2. **Start the app** (fresh cache, port 3030):
   ```bash
   npm run run
   ```
   Or without clearing cache:
   ```bash
   npm run dev:open
   ```

3. **Wait** until you see in the terminal:
   ```text
   ✓ Ready in ...
   - Local: http://localhost:3030
   ```

4. **Open in browser:** [http://localhost:3030](http://localhost:3030)

**Flow:** Logo → tap or wait → intro words → **CREATE** (profile) or **SKIP** (Zone). Profile works even if the database isn’t set up (a guest id is used and you still go to summary → Zone).

---

## If it still doesn’t work

- **“This site can’t be reached” / connection refused**  
  The server isn’t running or not on 3030. Make sure the terminal shows `Ready` and no red errors. Then open **http://localhost:3030** (not 3000).

- **Blank or broken page**  
  Hard refresh: **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows).  
  Open DevTools (F12) → **Console** and check for red errors.

- **Project in iCloud**  
  If the project lives in **iCloud Drive** (e.g. “Mobile Documents”), sync or path issues can break the dev server. Copy the project to a local folder (e.g. `~/Projects/00-00`) and run `npm run run` from there.

- **Use production build instead**  
  ```bash
  npm run build
  npm run start:3030
  ```
  Then open [http://localhost:3030](http://localhost:3030).
