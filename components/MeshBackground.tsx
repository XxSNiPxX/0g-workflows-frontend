export default function MeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
      <div className="absolute inset-0 bg-white" />
      <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)' }} />
      <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full opacity-40"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-1/4 w-[800px] h-[500px] rounded-full opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)' }} />
      <div className="absolute inset-0 opacity-[0.025]"
        style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
    </div>
  );
}
