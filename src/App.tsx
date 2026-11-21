import { useEffect, useState } from 'react';
import { getActiveCatalog, getPlan, openDatabase, savePlan, type UlamDatabase } from './data/database';
import type { Catalog, Plan } from './data/schema';
import { addDays, localDate, searchRecipes, weekStart } from './domain';
import { isReady, prepareOffline } from './offline';
type Recipe = Catalog['recipes'][number];
const initialPage = () => location.hash.slice(1) || location.pathname.slice(1) || 'recipes';
export function App() {
  const [db, setDb] = useState<UlamDatabase>();
  const [catalog, setCatalog] = useState<Catalog>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Preparing the app shell…');
  const [error, setError] = useState('');
  const [page, setPage] = useState(initialPage);
  const [query, setQuery] = useState('');
  const [recipe, setRecipe] = useState<Recipe>();
  const [date, setDate] = useState(localDate(new Date()));
  const [slot, setSlot] = useState<Plan['slot']>('dinner');
  const [servings, setServings] = useState(2);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);
  const week = weekStart(date);
  useEffect(() => {
    let database: UlamDatabase | undefined;
    const refresh = () => setPage(initialPage());
    window.addEventListener('hashchange', refresh);
    (async () => {
      if (!('serviceWorker' in navigator) || !('indexedDB' in window)) throw new Error('This browser does not support offline storage. Please use a current browser.');
      await navigator.serviceWorker.register('/sw.js');
      await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('App setup timed out. Check your connection and reload.')), 15000))]);
      if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
      database = await openDatabase();
      database.on('versionchange', () => { database?.close(); setDb(undefined); setError('An app update needs this tab to reload. Your saved meals are safe.'); });
      database.on('blocked', () => setError('Close other Ulam tabs, then retry the update.'));
      setDb(database); setCatalog(await getActiveCatalog(database));
      const complete = await isReady(database); setReady(complete);
      setMessage(complete ? 'Ready offline' : 'Download the sample recipes to use this preview offline.');
    })().catch(cause => setError(cause instanceof Error ? cause.message : 'Could not open local storage. Please reload.'));
    return () => { database?.close(); window.removeEventListener('hashchange', refresh); };
  }, []);
  useEffect(() => { if (db) db.plans.where('weekStart').equals(week).toArray().then(setPlans).catch(() => setError('Could not read your plan. Please retry.')); }, [db, week]);
  useEffect(() => { if (recipe) document.getElementById('recipe-detail')?.focus(); }, [recipe]);
  async function setup() {
    if (!db) return;
    setBusy(true); setError(''); setMessage('Checking offline files…');
    try { const downloaded = await prepareOffline(db, setMessage); if (!await isReady(db)) throw new Error('Some offline files are missing. Please retry online.'); setCatalog(downloaded); setReady(true); setMessage('Ready offline'); }
    catch (cause) {
      setReady(false);
      setMessage('Offline setup needs repair. Reconnect and retry.');
      setError(cause instanceof Error && cause.name === 'QuotaExceededError' ? 'Not enough storage for the download. Free some space and retry; your saved meals are still here.' : cause instanceof Error && !['TypeError','ZodError'].includes(cause.name) ? cause.message : 'Download interrupted or invalid. Reconnect and retry.');
    }
    finally { setBusy(false); }
  }
  async function addToPlan(event: React.FormEvent) {
    event.preventDefault(); if (!db || !catalog || !recipe) return;
    setSaving(true); setError('');
    try {
      if (await getPlan(db, date, slot) && !window.confirm('Replace the meal already in this slot?')) return;
      await savePlan(db, { weekStart: week, date, slot, recipeId: recipe.id, recipeRevision: recipe.revision, catalogReleaseId: catalog.releaseId, servings, updatedAt: new Date().toISOString() }); setPlans(await db.plans.where('weekStart').equals(week).toArray()); setMessage('Meal saved to your plan.');
    }
    catch { setError('Could not save your meal. Your choices are still here; please retry.'); }
    finally { setSaving(false); }
  }
  return <div className="app">
    <a className="skip" href="#content" onClick={event => {event.preventDefault(); document.getElementById('content')?.focus();}}>Skip to content</a>
    <header><a className="brand" href="#recipes">ulam<span>?</span></a><a href="#settings">Settings</a></header>
    <div className="preview">Development preview · 2 sample recipes · not the release catalog</div>
    <nav aria-label="Main navigation">{['recipes','plan','groceries'].map(item => <a key={item} href={`#${item}`} aria-current={page === item ? 'page' : undefined}>{item[0].toUpperCase() + item.slice(1)}</a>)}</nav>
    <main id="content" tabIndex={-1}>
      <section className="readiness" aria-label="Offline setup"><div><strong>{ready ? 'Ready offline' : 'Prepare your kitchen'}</strong><p role="status">{message}</p></div>{!ready && <button disabled={!db || busy} onClick={setup}>{busy ? 'Downloading…' : catalog ? 'Repair offline files' : 'Download for offline use'}</button>}</section>
      {error && <p className="error" role="alert">{error}</p>}
      {page === 'recipes' && <>
        <p className="eyebrow">A LITTLE INSPIRATION FOR EVERYDAY MEALS</p><h1>Anong ulam<span>?</span></h1><p className="lede">Find something simple. Make it part of your week.</p>
        <label className="search">Search recipes<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try sinangag, itlog, or bawang" /></label>
        {!catalog ? <p className="empty">Your sample recipe shelf is waiting. Download it above to get started.</p> : <>
          <div className="cards">{searchRecipes(catalog, query).map(item => { const image = catalog.images.find(asset => asset.id === item.imageId)!; return <article className="card" key={item.id}><RecipeImage key={`${image.id}-${ready}`} path={image.path} alt={image.alt} onMissing={() => {setReady(false); setMessage('An image is missing. Reconnect and repair downloads.');}} /><div><p className="eyebrow">{item.prepMinutes + item.cookMinutes} MIN · {item.yieldServings} SERVINGS</p><h2>{item.title}</h2><p>{item.summary}</p><button onClick={() => {setRecipe(item); setServings(item.yieldServings);}}>View recipe &amp; plan</button></div></article>; })}</div>
          {searchRecipes(catalog, query).length === 0 && <div className="empty"><h2>No recipes found</h2><p>Try another dish or ingredient.</p><button onClick={() => setQuery('')}>Reset search</button></div>}
        </>}
        {recipe && catalog && <section className="detail" id="recipe-detail" tabIndex={-1} aria-label={`${recipe.title} details`}><h2>{recipe.title}</h2><p>Development recipe · not kitchen-tested. Allergen information is unreviewed.</p><h3>Ingredients</h3><ul>{recipe.ingredients.map(line => <li key={line.id}>{line.amount.kind === 'exact' ? `${line.amount.numerator / line.amount.denominator} ${line.unit}` : line.amount.kind === 'qualitative' ? line.amount.label : `${line.amount.min.numerator / line.amount.min.denominator}–${line.amount.max.numerator / line.amount.max.denominator} ${line.unit}`} {catalog.ingredients.find(item => item.id === line.ingredientId)?.name} — {line.form}{line.prepNote ? `, ${line.prepNote}` : ''}{line.optional ? ' (optional)' : ''}</li>)}</ul><h3>Directions</h3><ol>{recipe.steps.map(step => <li key={step.id}>{step.text}</li>)}</ol>
          <form onSubmit={addToPlan}><h3>Add to your plan</h3><div className="fields"><label>Date<input required type="date" value={date} onChange={event => event.target.value && setDate(event.target.value)} /></label><label>Meal<select value={slot} onChange={event => setSlot(event.target.value as Plan['slot'])}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option></select></label><label>Servings<input required type="number" min="1" max="100" step="1" value={servings} onChange={event => setServings(Number(event.target.value))} /></label></div><button disabled={saving}>{saving ? 'Saving…' : 'Save meal'}</button></form>
        </section>}
      </>}
      {page === 'plan' && <><p className="eyebrow">MAKE ROOM FOR GOOD FOOD</p><h1>Your week</h1><div className="week-controls"><button onClick={() => setDate(addDays(date, -7))}>Previous week</button><h2>Week of {week}</h2><button onClick={() => setDate(addDays(date, 7))}>Next week</button></div><div className="days" aria-label="Choose day">{Array.from({length:7}, (_, index) => addDays(week, index)).map(day => <button key={day} aria-pressed={day === date} onClick={() => setDate(day)}>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {weekday:'short', day:'numeric'})}</button>)}</div><h2>{date}</h2>{(['breakfast','lunch','dinner'] as const).map(meal => { const entry = plans.find(item => item.date === date && item.slot === meal); return <section className="meal" key={meal}><h3>{meal[0].toUpperCase() + meal.slice(1)}</h3>{entry ? <PinnedMeal db={db} entry={entry} /> : <p>A little space for something good. <a href="#recipes">Choose a recipe</a></p>}</section>; })}</>}
      {page === 'groceries' && <><h1>Groceries</h1><p className="empty">Grocery lists aren’t available in this development preview.</p></>}
      {page === 'settings' && <><h1>Your kitchen</h1><section className="detail"><h2>Offline &amp; local storage</h2><p>{ready ? 'The sample catalog and images are ready offline in this browser.' : 'Offline files need setup or repair.'}</p><p>Your meal plans live on this device and in this browser. Clearing site data removes them. An installed app may use a different storage context.</p><button disabled={!db || busy} onClick={setup}>Check and repair downloads</button><h2>Install Ulam?</h2><p>Use your browser’s Install app option when available. On iPhone Safari, use Share → Add to Home Screen. Open the installed app and check readiness there.</p></section></>}
    </main><footer>Made for the everyday table.</footer>
  </div>;
}
function RecipeImage({path, alt, onMissing}: {path:string; alt:string; onMissing:()=>void}) {
  const [missing,setMissing] = useState(false);
  return missing ? <div className="missing" role="img" aria-label={alt}>Image unavailable · repair downloads in Settings</div> : <img src={`/${path}`} alt={alt} width="320" height="240" onError={() => {setMissing(true); onMissing();}} />;
}
function PinnedMeal({db,entry}: {db?:UlamDatabase; entry:Plan}) {
  const [title,setTitle] = useState('Saved recipe');
  useEffect(() => { db?.catalog.get(entry.catalogReleaseId).then(catalog => setTitle(catalog?.recipes.find(recipe => recipe.id === entry.recipeId)?.title ?? 'Saved recipe')).catch(() => setTitle('Saved recipe')); }, [db,entry]);
  return <p><strong>{title}</strong> · {entry.servings} servings</p>;
}
