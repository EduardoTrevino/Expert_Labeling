"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnnotateTab from "@/components/AnnotateTab";
import CompleteTab from "@/components/CompleteTab";
import UploadTab from "@/components/UploadTab";
import DownloadTab from "@/components/DownloadTab";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("annotate");

  return (
    <div className="min-h-screen bg-white p-6">
      <Tabs defaultValue="annotate" className="w-full" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 bg-navy-50">
          <TabsTrigger value="annotate" className="text-navy-900 data-[state=active]:bg-navy-100">Annotate</TabsTrigger>
          <TabsTrigger value="complete" className="text-navy-900 data-[state=active]:bg-navy-100">Complete</TabsTrigger>
          <TabsTrigger value="upload" className="text-navy-900 data-[state=active]:bg-navy-100">Upload</TabsTrigger>
          <TabsTrigger value="download" className="text-navy-900 data-[state=active]:bg-navy-100">Download</TabsTrigger>
        </TabsList>
        <TabsContent value="annotate">
          <AnnotateTab />
        </TabsContent>
        <TabsContent value="complete">
          <CompleteTab />
        </TabsContent>
        <TabsContent value="upload">
          <UploadTab />
        </TabsContent>
        <TabsContent value="download">
          <DownloadTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}