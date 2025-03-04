"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnnotateTab from "@/components/AnnotateTab";
import CompleteTab from "@/components/CompleteTab";
import UploadTab from "@/components/UploadTab";
import DownloadTab from "@/components/DownloadTab";
import UserHeader from "@/components/UserHeader";

// Extend the Window interface to include voiceflow
declare global {
  interface Window {
    voiceflow?: {
      chat: {
        load: (config: {
          verify: { projectID: string };
          url: string;
          versionID: string;
          voice: { url: string };
        }) => void;
      };
    };
  }
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("annotate");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
    script.type = "text/javascript";
    script.async = true;
    script.onload = () => {
      if (window.voiceflow?.chat) {
        window.voiceflow.chat.load({
          verify: { projectID: "67c698291971d22cda97e102" },
          url: "https://general-runtime.voiceflow.com",
          versionID: "production",
          voice: { url: "https://runtime-api.voiceflow.com" },
        });
      }
    };
    document.body.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-white p-6">
      <UserHeader />
      <Tabs
        defaultValue="annotate"
        className="w-full"
        value={activeTab}
        onValueChange={setActiveTab}
      >
        <TabsList className="grid w-full grid-cols-4 bg-navy-50">
          <TabsTrigger
            value="annotate"
            className="text-navy-900 data-[state=active]:bg-navy-100"
          >
            Annotate
          </TabsTrigger>
          <TabsTrigger
            value="complete"
            className="text-navy-900 data-[state=active]:bg-navy-100"
          >
            Complete
          </TabsTrigger>
          <TabsTrigger
            value="upload"
            className="text-navy-900 data-[state=active]:bg-navy-100"
          >
            Upload
          </TabsTrigger>
          <TabsTrigger
            value="download"
            className="text-navy-900 data-[state=active]:bg-navy-100"
          >
            Download
          </TabsTrigger>
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
