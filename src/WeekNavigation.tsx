import { addDays, monday, weekLabel } from './menu';
export default function WeekNavigation({week,disabled,onChange}:{week:string;disabled:boolean;onChange:(value:string)=>void}) {
 return <><div className="week-navigation">
  <button className="secondary compact" aria-label="Semana anterior" disabled={disabled} onClick={()=>onChange(addDays(week,-7))}>←</button>
  <label>Semana del<input type="date" value={week} disabled={disabled} onChange={e=>{if(e.target.value)onChange(monday(e.target.value));}}/></label>
  <button className="secondary compact" aria-label="Semana siguiente" disabled={disabled} onClick={()=>onChange(addDays(week,7))}>→</button>
 </div><p className="week-range">{weekLabel(week)}</p></>;
}
