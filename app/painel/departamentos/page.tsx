import type {Metadata} from "next";
import {DepartmentsManager} from "@/components/departments-manager";
export const metadata:Metadata={title:"Departamentos e EBD"};
export default function DepartmentsPage(){return <DepartmentsManager/>;}
