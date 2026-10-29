import { apiUrl } from '@/lib/api';

export type PaidAttempt={id:number;activityId:string;title:string;startsAt:string;location:string;image:string|null;quantity:number;amountCents:number;status:string;registrationId:number|null;createdAt:string};
export type PaidBookingRequest={requestId:string;activityId:string;quantity:number;firstName:string;lastName:string;email:string;phone:string;acknowledged:true};
type Checkout={id:number;url:string;status:string};

async function call<T>(path:string,token:string,options:RequestInit={}){
  const response=await fetch(`${apiUrl}/api/paid-activity-bookings${path}`,{
    ...options,
    headers:{Accept:'application/json',Authorization:`Bearer ${token}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},
  });
  if(!response.ok){
    let message='Le paiement est momentanément indisponible.';
    try{const body=await response.json() as {message?:string};if(body.message)message=body.message;}catch{}
    if(response.status===401)message='Votre session a expiré. Reconnectez-vous.';
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export const getPaidAttempts=(token:string)=>call<PaidAttempt[]>('',token);
export async function createPaidCheckout(token:string,body:PaidBookingRequest){
  const checkout=await call<Checkout>('',token,{method:'POST',body:JSON.stringify(body)});
  if(!checkout.url.startsWith('https://checkout.stripe.com/'))throw new Error('Lien de paiement invalide.');
  return checkout;
}
