import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

// Render the real preview with a local PDF.js stub: no server, real resume or model calls.
// Run npm run build first so the browser uses production Tailwind/CSS.
const root = fileURLToPath(new URL('../', import.meta.url))
await build({ stdin: { contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {PdfPages} from './src/features/resume/PdfPages';
import {AppShell} from './src/features/workspace/AppShell';
import {ResumeReviewView} from './src/features/resume/ResumeReviewView';
const file = new File(['demo'], 'demo.pdf');
const mode = window.fixture;
const preview = <PdfPages file={file}/>;
window.resumeText = '项目经历\\n' + Array.from({length:70}, (_,i)=>'功能描述 '+i+'：负责页面开发与验证，保留完整的原文内容。').join('\\n');
const noop=()=>{};
const workspace=<AppShell mode="diagnosis" headerless badges={{}} onNavigate={noop} onOpenHistory={noop} settingsOpen={false} onOpenSettings={noop} onCloseSettings={noop}><div className="flex min-h-0 min-w-0 flex-1 flex-col"><ResumeReviewView embedded sourceFile="demo.pdf" extracted={{text:window.resumeText,charCount:3000,pageCount:2}} analyzing={false} envConfigured={false} clientConfigured={false} onConfirm={noop} onBack={noop} onApplications={noop} onSaveReview={async()=>{}} onSaveRevisionDraft={async()=>{}} onSaveRevision={async()=>{}}/></div></AppShell>;
const content = mode === 'editor' ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">{preview}</div>
 : mode === 'tailoring' ? <div className="tailoring-review-scroll tailoring-canvas"><div className="tailoring-pdf"><p className="tailoring-source-note">点击原文直接修改</p>{preview}</div></div>
 : <div className="resume-template-preview-pages">{preview}</div>;
createRoot(document.getElementById('root')).render(mode.startsWith('workspace') ? workspace : <section style={{display:'flex', flexDirection:'column', height:600, maxHeight:'85vh', width:'min(700px, 100vw)',minHeight:0,overflow:'hidden'}}>
<header style={{height:40, flex:'none'}}>简历预览</header>{content}<footer data-footer style={{height:60,flex:'none',background:'#eee'}}>下方操作区域 <button>保存 PDF</button></footer></section>);
`, resolveDir: root, loader: 'tsx' }, outfile: resolve(root, 'dist/pdf-preview-fixture.js'), bundle: true, format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'pdf-fixture', setup(build) {
  build.onResolve({filter:/use-resume-review$/},()=>({path:'review',namespace:'fixture'}))
  build.onResolve({filter:/use-resume-pdf$/},()=>({path:'pdf-hook',namespace:'fixture'}))
  build.onResolve({ filter: /\/pdfjs$/ }, () => ({ path: 'pdfjs', namespace: 'fixture' }))
  build.onResolve({ filter: /\/resume-pdf$/ }, () => ({ path: 'constants', namespace: 'fixture' }))
  build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: root, contents: args.path === 'review' ? `
import {useState} from 'react';
import {parseResumeStructure} from './src/domain/resume-structure';
import {tailoringSections} from './src/domain/resume-tailoring';
import {createReviewCandidates,groupCandidates} from './src/features/resume/resume-review-utils';
export function useResumeReview(){
const text=window.resumeText; const sections=parseResumeStructure(text), candidates=createReviewCandidates(text);
const [tab,setTab]=useState(window.fixture==='workspace-diagnosis'?'diagnosis':window.fixture==='workspace-structure'?'structure':'raw');
const [writingMode,setWritingMode]=useState(window.fixture==='workspace-full'?'full':'paragraphs');
const [mobileDocument,setMobileDocument]=useState(false),[editingParagraph,setEditingParagraph]=useState(null);
const file=new File(['demo'],'demo.pdf');
const artifact={file,text,inputText:text,sourceFile:'demo.pdf',pageCount:2,pages:[]};
const diagnosis={report:{source:'demo',summary:'演示检查',strengths:[],nextSteps:['核对内容'],issues:Array.from({length:8},(_,i)=>({title:'建议 '+i,dimension:'content',priority:'high',evidence:'原文',problem:'检查问题。'.repeat(30),suggestion:'具体修改建议。'.repeat(30)}))},generate(){},cancel(){}};
return new Proxy({text,editingText:text,sections,candidates,groupedCandidates:groupCandidates(candidates,sections),selectedCandidates:candidates,paragraphSections:tailoringSections(text),pdf:{artifact,loading:false,retry(){}},sourcePhotos:{photos:[],loading:false,error:''},editRequest:null,photo:null,template:'classic',diagnosis,revisionDraft:null,lastDeleted:null,saveState:'saved',draftSaveState:'saved',analysisGoal:'overall',jobDescription:'',mobileDocument,setMobileDocument,tab,setTab,writingMode,setWritingMode,editingParagraph,setEditingParagraph,revisionPending:false,revisionBusy:false,revisionConflict:false,revisionError:null,workflowBlocked:false,leaving:false,analyzing:false,canUseOriginal:false,original:undefined,originalError:null,photoUnresolved:false,previewOpen:false,editingId:null,sidebarOpen:false,goalOpen:false,jdOpen:false},{get:(target,key)=>key in target?target[key]:()=>{}})
}` : args.path === 'pdf-hook' ? 'export function useResumePdf(){return {artifact:null,error:null,loading:false,retry(){}}}' : args.path === 'constants' ? 'export const RESUME_PAGE={width:595,height:842,margin:40}; export async function createResumePdf(){throw new Error("fixture")}' : `export async function getPdfJs(){return {getDocument(){return {destroy:async()=>{},promise:Promise.resolve({numPages:2,getPage:async()=>({getViewport:({scale})=>({width:595*scale,height:842*scale}),render:({canvas})=>{const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#222';ctx.font='24px sans-serif';ctx.fillText('Resume preview / layout fixture',40,60);return {promise:Promise.resolve(),cancel(){}}}})})}}}}` }))
} }] })
const chunks = resolve(root, '.next/static/chunks')
const css = (await Promise.all((await readdir(chunks)).filter(name => name.endsWith('.css')).map(name => readFile(resolve(chunks, name), 'utf8')))).join('\n')
let browser
for (const channel of ['msedge', 'chrome', undefined]) {
  try { browser = await chromium.launch({ channel, headless: true }); break } catch { /* Try another installed browser. */ }
}
if (!browser) throw new Error('预览布局检查需要安装 Edge / Chrome 或 Playwright Chromium。')
const results = []
try {
  for (const mode of ['editor', 'tailoring', 'template']) for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.setContent('<html><head></head><body style="margin:0"><div id="root"></div></body></html>')
    await page.addStyleTag({ content: css })
    await page.evaluate(mode => { window.fixture = mode }, mode)
    await page.addScriptTag({ path: resolve(root, 'dist/pdf-preview-fixture.js') })
    await page.locator('[data-pdf-page]').first().waitFor()
    const snapshot = () => page.evaluate(() => {
      const viewport = document.querySelector('[aria-label="简历预览画布"]'), pdf = document.querySelector('[data-pdf-page]'), footer = document.querySelector('[data-footer]')
      return { footer: footer.getBoundingClientRect().top, footerHeight: footer.getBoundingClientRect().height, pageWidth: pdf.getBoundingClientRect().width, bottom: viewport.getBoundingClientRect().bottom, viewportHeight: viewport.clientHeight, scrollHeight: viewport.scrollHeight, scrollWidth: viewport.scrollWidth, viewportWidth: viewport.clientWidth, zoom: document.querySelector('[aria-live="polite"]').textContent }
    })
    const before = await snapshot()
    const canvas = page.getByLabel('简历预览画布')
    await canvas.hover()
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control')
    await page.waitForFunction(() => document.querySelector('[aria-live="polite"]').textContent === '110%')
    let after = await snapshot()
    assert(Math.abs(after.pageWidth / before.pageWidth - 1.1) < .01, `${mode}/${width}: visual zoom`)
    await page.keyboard.down('Control')
    for (let i = 0; i < 19; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(20) }
    await page.keyboard.up('Control')
    await page.waitForFunction(() => document.querySelector('[aria-live="polite"]').textContent === '300%')
    after = await snapshot()
    assert(Math.abs(after.footer - before.footer) <= 1, `${mode}/${width}: footer moved`)
    assert(after.footerHeight === before.footerHeight && after.footerHeight === 60, `${mode}/${width}: footer shrank`)
    assert(after.bottom <= after.footer + 1 && after.viewportHeight > 100, `${mode}/${width}: viewport escaped panel`)
    assert(after.scrollHeight > after.viewportHeight && after.scrollWidth > after.viewportWidth, `${mode}/${width}: internal overflow absent`)
    await page.evaluate(() => { const canvas = document.querySelector('[aria-label="简历预览画布"]'); canvas.scrollTop = 100; canvas.scrollLeft = 100 })
    await canvas.hover()
    const position = await canvas.boundingBox()
    await page.mouse.down({ button: 'middle' })
    await page.keyboard.down('Control'); await page.mouse.wheel(0,120); await page.keyboard.up('Control')
    assert((await snapshot()).zoom==='300%', `${mode}/${width}: zoom changed during drag`)
    await page.mouse.move(position.x + position.width / 2 - 40, position.y + position.height / 2 - 40)
    await page.mouse.up({ button: 'middle' })
    const pan = await page.evaluate(() => { const canvas = document.querySelector('[aria-label="简历预览画布"]'); return { x: canvas.scrollLeft, y: canvas.scrollTop } })
    assert(Math.abs(pan.x - 140) < 2 && Math.abs(pan.y - 140) < 2, `${mode}/${width}: middle-button pan failed`)
    // Reach the last PDF page using the normal left button, without modifiers.
    await page.evaluate(() => { const canvas = document.querySelector('[aria-label="简历预览画布"]'); canvas.scrollTop = 0 })
    for (let step = 0; step < 100; step++) {
      const atBottom = await canvas.evaluate(element => element.scrollTop >= element.scrollHeight - element.clientHeight - 1)
      if (atBottom) break
      const bounds = await canvas.boundingBox()
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height - 12)
      await page.mouse.down({ button: 'left' })
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 12)
      await page.mouse.up({ button: 'left' })
    }
    const bottom = await page.evaluate(() => {
      const canvas = document.querySelector('[aria-label="简历预览画布"]'), last = [...document.querySelectorAll('[data-pdf-page]')].at(-1)
      return { bottom: last.getBoundingClientRect().bottom, top: canvas.getBoundingClientRect().top, viewportBottom: canvas.getBoundingClientRect().bottom, reached: canvas.scrollHeight - canvas.clientHeight - canvas.scrollTop < 2 }
    })
    assert(bottom.reached && bottom.bottom <= bottom.viewportBottom + 1 && bottom.bottom > bottom.top, `${mode}/${width}: last PDF page bottom is unreachable by left drag`)
    await page.getByRole('button', { name: '适应宽度' }).click()
    await page.waitForFunction(() => document.querySelector('[aria-live="polite"]').textContent === '100%')
    await page.evaluate(() => { document.querySelector('[aria-label="简历预览画布"]').scrollTop = 0 })
    await canvas.hover(); await page.mouse.wheel(0, 200)
    await page.waitForTimeout(100)
    const scroll = await page.evaluate(() => document.querySelector('[aria-label="简历预览画布"]').scrollTop)
    assert((await snapshot()).zoom==='100%', `${mode}/${width}: scrolling changed zoom`)
    assert(scroll > 0, `${mode}/${width}: plain wheel did not scroll vertically`)
    results.push({ mode, width, before, after, shiftScroll: scroll })
    await page.close()
  }
  for (const mode of ['workspace-paragraphs','workspace-full','workspace-diagnosis','workspace-structure']) for (const width of [1440,900,390]) {
    const page=await browser.newPage({viewport:{width,height:900}})
    page.on('pageerror',error=>console.error(error.message))
    await page.setContent('<html><body style="margin:0"><div id="root"></div></body></html>')
    await page.addStyleTag({content:css}); await page.evaluate(mode=>{window.fixture=mode},mode)
    await page.addScriptTag({path:resolve(root,'dist/pdf-preview-fixture.js')})
    const name=mode==='workspace-full'?'简历全文':mode==='workspace-diagnosis'?'检查建议滚动区':mode==='workspace-structure'?'练习内容滚动区':'简历段落滚动区'
    const left=mode==='workspace-full'?page.locator('textarea[aria-label="简历全文"]'):page.getByLabel(name,{exact:true})
    await left.waitFor({state:'visible'})
    assert(await left.evaluate(el=>el.clientHeight>50 && el.scrollHeight>el.clientHeight),mode+'/'+width+': left pane is not scrollable')
    await left.hover(); await page.mouse.wheel(0,500); await page.waitForTimeout(100)
    assert(await left.evaluate(el=>el.scrollTop>0),mode+'/'+width+': wheel cannot scroll text')
    await left.evaluate(el=>{el.scrollTop=el.scrollHeight})
    assert(await left.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight<2),mode+'/'+width+': last text is unreachable')
    const bounds=await left.boundingBox()
    assert(bounds.y+bounds.height<=900,mode+'/'+width+': text area escapes workspace')
    if(mode==='workspace-paragraphs') {
      const last=left.locator('article section').last()
      const lastBounds=await last.boundingBox()
      assert(lastBounds.y+lastBounds.height<=bounds.y+bounds.height+1,mode+'/'+width+': last paragraph clipped')
      if(width<1100) await page.getByRole('button',{name:'简历预览',exact:true}).click()
      const canvas=page.getByLabel('简历预览画布',{exact:true}); await canvas.waitFor({state:'visible'}); await canvas.hover(); await page.keyboard.down('Control'); await page.mouse.wheel(0,-120); await page.keyboard.up('Control')
      await page.waitForFunction(()=>document.querySelector('[aria-live="polite"]').textContent==='110%')
      if(width<1100) await page.getByRole('button',{name:'全文编辑',exact:true}).click()
      await left.hover(); await page.mouse.wheel(0,-200); await page.waitForTimeout(100)
      assert(await left.evaluate(el=>el.scrollTop<el.scrollHeight-el.clientHeight),mode+'/'+width+': right preview disabled left scrolling')
    }
    results.push({mode,width,leftScroll:true}); await page.close()
  }
  await writeFile(resolve(root, 'dist/pdf-preview-check.json'), JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ passed: results.length, workspaceModes: 4, workspaceWidths:[1440,900,390] }))
} finally { await browser.close() }
