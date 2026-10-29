import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, Meetings, OfficeObject, Participant, Signal } from './types';
export function useOffice(room: string, profile: {name: string;color: string} | null) {
  const socket = useRef<WebSocket | null>(null);
  const listeners = useRef(new Set<(signal: Signal) => void>());
  const [selfId,setSelfId] = useState<string|null>(null);
  const [participants,setParticipants] = useState<Participant[]>([]);
  const [meetings,setMeetings] = useState<Meetings>({});
  const [areaNames,setAreaNames] = useState<Record<string,string>>({});
  const [messages,setMessages] = useState<ChatMessage[]>([]);
  const [objects,setObjects] = useState<OfficeObject[]>([]);
  const [overrides,setOverrides] = useState<Record<string, { facing?: string; x?: number; y?: number; removed?: boolean }>>({});
  const [connection,setConnection] = useState<'idle'|'connecting'|'online'|'offline'>('idle');
  const [error,setError] = useState('');
  const profileRef = useRef(profile); profileRef.current=profile;
  const enabled=!!profile;
  useEffect(()=>{
    if(!enabled) {setConnection('idle');setSelfId(null);setParticipants([]); return;}
    let disposed=false; let timer: ReturnType<typeof setTimeout>; let retries=0;
    function connect() {
      if(disposed)return;
      setConnection('connecting');
      const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws?room=${encodeURIComponent(room)}`);
      socket.current=ws;
      ws.onopen=()=>{retries=0;ws.send(JSON.stringify({type:'join',...profileRef.current}));};
      ws.onmessage=(event)=>{
        let data;try {data=JSON.parse(event.data);}catch{return;}
        if(data.type==='welcome'){setSelfId(data.id);setParticipants(data.participants);setMeetings(data.meetings??{});setAreaNames(data.areaNames??{});setMessages(data.messages);setObjects(data.objects);setOverrides(data.overrides??{});setConnection('online');setError('');}
        if(data.type==='participants'){setParticipants(data.participants);if(data.meetings)setMeetings(data.meetings);}
        if(data.type==='areas')setAreaNames(data.areaNames??{});
        if(data.type==='objects'){setObjects(data.objects);setOverrides(data.overrides??{});}
        if(data.type==='chat')setMessages(old=>[...old,data.message].slice(-200));
        if(data.type==='signal')listeners.current.forEach(fn=>fn(data));
        if(data.type==='error')setError(data.message);
      };
      ws.onclose=()=>{if(disposed)return;setConnection('offline');setParticipants([]);setSelfId(null);timer=setTimeout(connect,Math.min(1000*2**retries++,10000));};
      ws.onerror=()=>setError('No se pudo conectar con la oficina. Reintentando…');
    }
    connect();
    return()=>{disposed=true;clearTimeout(timer);socket.current?.close();socket.current=null;};
  },[enabled,room]);
  const send=useCallback((data:Record<string,unknown>)=>{if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify(data));},[]);
  const subscribeSignal=useCallback((listener:(signal:Signal)=>void)=>{listeners.current.add(listener);return()=>{listeners.current.delete(listener);};},[]);
  return {selfId,participants,meetings,areaNames,messages,objects,overrides,connection,error,setError,send,subscribeSignal};
}
