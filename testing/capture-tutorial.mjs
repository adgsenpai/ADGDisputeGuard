import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'output/tutorial'), tmp=path.join(root,'tmp/tutorial');
await mkdir(out+'/screenshots',{recursive:true}); await mkdir(tmp,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const ctx=await browser.newContext({viewport:{width:1600,height:1000},recordVideo:{dir:tmp,size:{width:1600,height:1000}},baseURL:'http://localhost:3100'});
const page=await ctx.newPage(); const scenes=[]; const events=[];
page.on('response',async r=>{if(/\/api\/(assistant|disputes\/\d+\/investigate)$/.test(r.url())) {try {events.push({url:r.url(),status:r.status(),body:await r.text()});}catch{}}});
let epoch=Date.now();
async function scene(id,title,action){const start=(Date.now()-epoch)/1000;await action();await page.waitForTimeout(1600);await page.screenshot({path:out+'/screenshots/'+id+'.png'});await page.screenshot({path:out+'/screenshots/'+id+'-full.png',fullPage:true});scenes.push({id,title,start,end:(Date.now()-epoch)/1000});console.log('Captured',id);await writeFile(tmp+'/capture.json',JSON.stringify(scenes,null,2));}
async function nav(key){await page.locator(`[data-nav="${key}"]`).click();await page.waitForTimeout(700);await page.evaluate(()=>window.scrollTo(0,0));}
async function sign(name){await page.getByRole('button',{name:`Sign in as ${name}`,exact:true}).click();await page.getByTestId('console-shell').waitFor();}
async function switchTo(name){await page.getByRole('button',{name:'Sign out',exact:true}).first().click();await sign(name);}
try {
await scene('01-welcome','Welcome & sign-in',async()=>{await page.goto('/console');await page.getByRole('button',{name:'Sign in as Thabo Nkosi',exact:true}).waitFor();});
// A clearly labelled tutorial payment keeps existing cases untouched.
const api=await browser.newContext({baseURL:'http://localhost:3100'});
await api.request.post('/api/auth',{data:{action:'demo',userId:99}});
const payment=await api.request.post('/api/transactions',{data:{ownerId:1,merchant:'Tutorial Store - sample order',category:'Tutorial sample',amountMinor:275000}});
const txid=(await payment.json()).transactionId;await api.close();
await scene('02-dashboard','Customer dashboard',async()=>{await sign('Thabo Nkosi');});
await scene('03-statement','Review your statement',async()=>{await nav('statement');await page.getByRole('button',{name:'Check for possible disputes',exact:true}).click();await page.waitForTimeout(700);});
await scene('04-open-dispute','Open a dispute',async()=>{await page.getByLabel('Search payments').fill(String(txid));await page.getByRole('button',{name:'Review payment',exact:true}).click();await page.getByLabel('What went wrong?').fill('Tutorial example: my order did not arrive. Please review the merchant confirmation and receipt.');});
await page.getByRole('button',{name:'Submit dispute',exact:true}).click();await page.waitForTimeout(1400);
const cases=await (await ctx.request.get('/api/disputes')).json();const dispute=cases.disputes.find(d=>d.transactionId===txid); if(!dispute)throw Error('Tutorial case not created');
await writeFile(tmp+'/case.json',JSON.stringify({txid,disputeId:dispute.id}));
await scene('05-evidence','Attach supporting evidence',async()=>{await nav('disputes');await page.locator('.trow').filter({hasText:`(tx ${txid})`}).getByRole('button',{name:'Inspect'}).click();await page.getByLabel('Upload evidence file').setInputFiles(root+'/tmp/tutorial/sample-receipt.png');await page.waitForTimeout(900);await page.getByLabel('Upload evidence file').scrollIntoViewIfNeeded();});
await scene('06-assistant','Ask the AI assistant',async()=>{await nav('assistant');await page.locator('.assistant-scope select').selectOption(String(txid));await page.getByLabel('Ask the investigation assistant').fill('In one short sentence, name one evidence item for my missing order.');await page.getByRole('button',{name:'Send question',exact:true}).click();await page.locator('.chat-message--assistant').waitFor({timeout:45000});});
await scene('07-analyst','Analyst queue & case controls',async()=>{await switchTo('Nomsa Mahlangu');await nav('disputes');await page.locator('.trow').filter({hasText:`(tx ${txid})`}).getByRole('button',{name:'Inspect'}).click();await page.getByRole('button',{name:'begin review',exact:true}).click();await page.getByRole('button',{name:'begin investigation',exact:true}).click();});
await scene('08-bounded-ai','Run a bounded AI investigation',async()=>{await page.getByRole('button',{name:'Run bounded investigation',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Run bounded investigation',exact:true}).click();await page.locator('.summary').waitFor({timeout:90000});await page.locator('.summary').scrollIntoViewIfNeeded();});
await scene('09-decision','Human review & case report',async()=>{await page.getByRole('button',{name:'approve',exact:true}).click();await page.getByRole('button',{name:'Download case report',exact:true}).scrollIntoViewIfNeeded();const report=await ctx.request.get(`/api/disputes/${dispute.id}/report`);if(!report.ok())throw Error('Report download failed');await writeFile(out+'/sample-case-report.pdf',await report.body());});
await scene('10-investigations','Investigation history',async()=>{await nav('investigations');});
await scene('11-audit','Audit history & verification',async()=>{await nav('audit');});
await scene('12-notifications','Notifications & email mode',async()=>{await switchTo('Thabo Nkosi');await nav('notifications');});
await scene('13-monitoring','Administrator monitoring',async()=>{await switchTo('Mandla Ndlovu');await nav('monitoring');await page.getByRole('button',{name:'Scan once',exact:true}).click();await page.waitForTimeout(900);});
await scene('14-access','People & access',async()=>{await nav('users');});
await scene('15-personalise','Theme, language & navigation',async()=>{await nav('dashboard');await page.getByRole('button',{name:'Switch to light theme',exact:true}).click();await page.getByLabel('Language',{exact:true}).selectOption('af');await page.waitForTimeout(900);await page.getByLabel('Language',{exact:true}).selectOption('en');});
await writeFile(tmp+'/ai-responses.json',JSON.stringify(events,null,2));
const video=page.video(); await ctx.close();await writeFile(tmp+'/video-path.txt',await video.path());
} finally {await browser.close();}
