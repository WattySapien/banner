import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps=React.ComponentProps<typeof Input>&{
  containerClassName?:string;
  visibilityLabel?:string;
};

const PasswordInput=React.forwardRef<HTMLInputElement,PasswordInputProps>(
  ({className,containerClassName,disabled,id,visibilityLabel="password",...props},ref)=>{
    const [isVisible,setIsVisible]=React.useState(false);
    const action=isVisible?"Hide":"Show";

    return (
      <div className={cn("relative",containerClassName)}>
        <Input ref={ref} id={id} type={isVisible?"text":"password"} disabled={disabled} className={cn("pr-11",className)} {...props}/>
        <button
          type="button"
          className="absolute right-0.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          onClick={()=>setIsVisible((visible)=>!visible)}
          disabled={disabled}
          aria-label={`${action} ${visibilityLabel}`}
          aria-controls={id}
          aria-pressed={isVisible}
        >
          {isVisible?<EyeOff className="size-4" aria-hidden="true"/>:<Eye className="size-4" aria-hidden="true"/>}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName="PasswordInput";

export { PasswordInput };
