const processSteps = [
  {
    number: "01",
    title: "연결",
    description: "프린터를 한 번 등록해 둬요",
  },
  {
    number: "02",
    title: "만들기",
    description: "말로 설명하거나 Feed에서 골라요",
  },
  {
    number: "03",
    title: "검증",
    description: "출력 가능한지 자동으로 검사해요",
  },
  {
    number: "04",
    title: "출력",
    description: "손쉬운 프린터 제어가 바로 이어져요",
  },
];

export function ProcessSection() {
  return (
    <section className="border-t border-zinc-100 bg-zinc-50 px-6 py-24 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-extrabold text-zinc-950 sm:text-4xl">
          연결부터 출력까지, 네 단계면 끝나요
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {processSteps.map((step) => (
            <article
              key={step.number}
              className="min-h-36 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-extrabold text-[#5B7FFF]">{step.number}</p>
              <h3 className="mt-5 text-lg font-extrabold text-zinc-950">{step.title}</h3>
              <p className="mt-3 text-sm font-medium leading-6 text-zinc-500">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
