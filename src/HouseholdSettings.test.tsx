import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
const api=vi.hoisted(()=>({getMembers:vi.fn(),manageMember:vi.fn(),deleteHousehold:vi.fn()}));
vi.mock('./householdManagement',()=>api);
vi.mock('./supabase',()=>({supabase:{from:()=>({select:()=>({order:async()=>({data:[],error:null})})})}}));
import HouseholdSettings from './HouseholdSettings';
const house={id:'house',name:'Casa',owner_id:'owner',deletion_requested_at:null};
const changed=vi.fn();
beforeEach(()=>{api.getMembers.mockResolvedValue([{user_id:'owner',display_name:'Alex',is_owner:true},{user_id:'member',display_name:'Sam',is_owner:false}]);api.manageMember.mockResolvedValue(undefined);api.deleteHousehold.mockResolvedValue(undefined);});
it('muestra solo salida a un miembro y requiere confirmar antes de salir',async()=>{
 render(<HouseholdSettings house={house} userId="member" online onChanged={changed}/>);
 await screen.findByText('Alex',{exact:true});
 expect(screen.queryByRole('button',{name:'Eliminar casa'})).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Crear enlace de invitación'})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Salir de la casa'}));expect(api.manageMember).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));
 await waitFor(()=>expect(api.manageMember).toHaveBeenCalledWith('leave',undefined));
});
it('exige escribir el nombre de la casa antes de eliminar',async()=>{
 render(<HouseholdSettings house={house} userId="owner" online onChanged={changed}/>);
 fireEvent.click(screen.getByRole('button',{name:'Eliminar casa'}));
 expect(screen.getByRole('button',{name:'Confirmar'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Escribe Casa'),{target:{value:'Casa'}});
 fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));
 await waitFor(()=>expect(api.deleteHousehold).toHaveBeenCalledWith(house,'Casa'));
});
it('transfiere a un miembro concreto y conserva el formulario si falla',async()=>{
 api.manageMember.mockRejectedValue(new Error('stale'));
 render(<HouseholdSettings house={house} userId="owner" online onChanged={changed}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Transferir propiedad a Sam'}));
 fireEvent.click(screen.getByRole('button',{name:'Confirmar'}));
 await screen.findByRole('alert');expect(api.manageMember).toHaveBeenCalledWith('transfer','member');expect(changed).not.toHaveBeenCalled();
});
it('ofrece reanudar una eliminación sin recuperar datos de la casa',async()=>{
 const pending={...house,deletion_requested_at:'2026-11-16'};
 render(<HouseholdSettings house={pending} userId="owner" online onChanged={changed}/>);
 expect(api.getMembers).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Completar eliminación'}));
 await waitFor(()=>expect(api.deleteHousehold).toHaveBeenCalledWith(pending,'Casa'));
});
it('desactiva acciones de administración sin conexión',async()=>{
 render(<HouseholdSettings house={house} userId="owner" online={false} onChanged={changed}/>);
 expect(await screen.findByRole('button',{name:'Quitar a Sam'})).toBeDisabled();expect(screen.getByRole('button',{name:'Eliminar casa'})).toBeDisabled();
});
