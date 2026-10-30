import { apiUrl } from '@/lib/api';

export type Booking={
  id:number; activityId:string; title:string; image:string; startsAt:string; location:string; quantity:number;
  firstName:string; lastName:string; email:string; phone:string; status:'CONFIRMEE'|'ANNULEE';
  activityCancelled:boolean; version:number; amountCents:number|null; paymentStatus:string|null;
};

export type BookingRequest={activityId:string;quantity:number;firstName:string;lastName:string;email:string;phone:string;acknowledged:true};

async function call<T>(path:string,token:string,options:RequestInit={}){
  const response=await fetch(`${apiUrl}/api/bookings${path}`,{
    ...options,
    headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},
  });
  if(!response.ok){
    let message='La demande n’a pas pu être traitée.';
    try{const body=await response.json() as {message?:string};if(body.message)message=body.message;}catch{}
    if(response.status===401)message='Votre session a expiré. Reconnectez-vous.';
    throw new Error(message);
  }
  return response.status===204?undefined as T:response.json() as Promise<T>;
}

export const getBookings=(token:string)=>call<Booking[]>('',token);
export const createBooking=(token:string,body:BookingRequest)=>call<Booking>('',token,{method:'POST',body:JSON.stringify(body)});
export const cancelBooking=(token:string,id:number)=>call<void>(`/${id}/cancel`,token,{method:'POST',body:'{}'});
