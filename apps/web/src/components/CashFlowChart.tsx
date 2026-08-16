import {Area,AreaChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from "recharts";
import {formatCurrency} from "@/lib/banking";

export default function CashFlowChart({data}:{data:Array<{month:string;income:number;spending:number}>}){
  return <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={data} margin={{top:8,right:0,left:-25,bottom:0}}>
      <defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(161 57% 28%)" stopOpacity={0.22}/><stop offset="100%" stopColor="hsl(161 57% 28%)" stopOpacity={0}/></linearGradient></defs>
      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize:11,fill:"hsl(215 14% 46%)"}}/>
      <YAxis axisLine={false} tickLine={false} tick={{fontSize:10,fill:"hsl(215 14% 46%)"}} tickFormatter={(value)=>`$${value/1000}k`} width={48}/>
      <Tooltip formatter={(value:number)=>formatCurrency(value)} contentStyle={{borderRadius:12,border:"1px solid hsl(214 20% 88%)",boxShadow:"0 14px 40px rgba(26,55,45,.12)"}}/>
      <Area type="monotone" dataKey="income" stroke="hsl(161 57% 28%)" strokeWidth={2.5} fill="url(#incomeFill)"/>
      <Area type="monotone" dataKey="spending" stroke="hsl(215 14% 58%)" strokeWidth={2} fill="transparent" strokeDasharray="4 5"/>
    </AreaChart>
  </ResponsiveContainer>;
}
