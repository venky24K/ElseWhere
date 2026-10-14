import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { TopNav } from '../components/Header/TopNav';
import { WorkspaceLayout } from '../components/Layout/WorkspaceLayout';
import { TemplateModal } from '../components/Modals/TemplateModal';
import { HostSetupModal } from '../components/Modals/HostSetupModal';
import { AiSettingsModal } from '../components/Modals/AiSettingsModal';
import { SettingsModal } from '../components/Modals/SettingsModal';
import { OneShotManuscriptModal } from '../components/AI/OneShotManuscriptModal';
import { VisionTikzStudioModal } from '../components/AI/VisionTikzStudioModal';
import { useProjectStore } from '../store/useProjectStore';
import { useAiStore } from '../store/useAiStore';

export function StudioLayout() {
  const { projectId } = useParams<{ projectId?: string }>();
  const initProject = useProjectStore((s) => s.initProject);
  const initAi = useAiStore((s) => s.initAi);
  const oneShotModalOpen = useAiStore((s) => s.oneShotModalOpen);
  const setOneShotModalOpen = useAiStore((s) => s.setOneShotModalOpen);
  const visionStudioModalOpen = useAiStore((s) => s.visionStudioModalOpen);
  const setVisionStudioModalOpen = useAiStore((s) => s.setVisionStudioModalOpen);

  useEffect(() => {
    initProject(projectId || 'default');
    initAi();
  }, [initProject, initAi, projectId]);

  return (
    <div className="fixed inset-0 flex flex-col h-screen w-screen bg-app text-text-primary overflow-hidden font-sans select-none">
      <TopNav />
      <WorkspaceLayout />

      {/* Interactive Modals */}
      <TemplateModal />
      <HostSetupModal />
      <AiSettingsModal />
      <SettingsModal />
      <OneShotManuscriptModal
        isOpen={oneShotModalOpen}
        onClose={() => setOneShotModalOpen(false)}
      />
      <VisionTikzStudioModal
        isOpen={visionStudioModalOpen}
        onClose={() => setVisionStudioModalOpen(false)}
      />
    </div>
  );
}

export default StudioLayout;
