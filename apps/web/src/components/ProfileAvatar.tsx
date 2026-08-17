import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function ProfileAvatar({src,userId,initials,alt,className}:{src?:string|null;userId?:string;initials:string;alt:string;className?:string}){
  const resolvedSrc=src??(userId?`/api/avatars/${encodeURIComponent(userId)}`:undefined);
  const [imageFailed,setImageFailed]=useState(false);
  useEffect(()=>setImageFailed(false),[resolvedSrc]);
  const showImage = Boolean(resolvedSrc) && !imageFailed;
  return <Avatar className={cn("rounded-xl bg-primary/10",className)}>
    {showImage ? <img key={resolvedSrc} src={resolvedSrc!} alt={alt} loading="eager" decoding="async" onError={()=>setImageFailed(true)} className="block aspect-square h-full w-full object-cover"/> : <span className="flex h-full w-full items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">{initials}</span>}
  </Avatar>;
}
