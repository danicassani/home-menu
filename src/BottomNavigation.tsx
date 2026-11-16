import type { ReactNode } from 'react';
export type View='recipes'|'week'|'shopping'|'house';
const views:{key:View;label:string;icon:ReactNode}[]=[
 {key:'recipes',label:'Carta',icon:<><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="3.2"/><path d="M2 3v5a2 2 0 0 0 4 0V3M4 3v18M22 3c-2 2-3 5-3 9h3V3Zm0 9v9"/></>},
 {key:'week',label:'Semana',icon:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M8 14h1m6 0h1M8 17h1m6 0h1"/></>},
 {key:'shopping',label:'Compra',icon:<><path d="M3 3h2l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/></>},
 {key:'house',label:'Casa',icon:<path d="m3 10.5 9-7.5 9 7.5M5 9.5V21h5v-7h4v7h5V9.5"/>},
];
export default function BottomNavigation({view,onChange}:{view:View;onChange:(view:View)=>void}){
 return <nav className="bottom-nav" aria-label="Secciones">
  {views.map(({key,label,icon})=><button key={key} type="button" aria-label={label} aria-pressed={view===key} onClick={()=>onChange(key)}>
   <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
  </button>)}
 </nav>;
}
