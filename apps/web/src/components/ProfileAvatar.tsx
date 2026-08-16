import { Avatar,AvatarFallback,AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function ProfileAvatar({src,initials,alt,className}:{src?:string|null;initials:string;alt:string;className?:string}){
  return <Avatar className={cn("rounded-xl bg-primary/10",className)}>
    {src&&<AvatarImage src={src} alt={alt} className="object-cover"/>}
    <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">{initials}</AvatarFallback>
  </Avatar>;
}
