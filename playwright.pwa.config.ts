import { defineConfig } from '@playwright/test';
export default defineConfig({
 outputDir:'test-results-pwa',testDir:'./e2e',testMatch:'pwa.spec.ts',fullyParallel:false,workers:1,retries:0,
 use:{baseURL:'http://127.0.0.1:4176',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH},trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1365,height:900}}},{name:'mobile',use:{viewport:{width:390,height:844}}}],
 webServer:{command:'npm run build && npm run preview -- --host 127.0.0.1 --port 4176 --strictPort',url:'http://127.0.0.1:4176',reuseExistingServer:false,timeout:120000,
 env:{VITE_SUPABASE_URL:'https://fixture.supabase.co',VITE_SUPABASE_ANON_KEY:'public-test-key'}},
});
