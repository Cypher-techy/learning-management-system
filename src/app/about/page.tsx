import StaticPage, { H, P, UL } from "@/components/StaticPage";
export const metadata = { title: "About Elimu Bora" };
export default function About() {
  return <StaticPage eyebrow="About" title="About Elimu Bora" intro="Elimu Bora is an independent Kenyan learning platform built to make quality education reachable from any phone, in any county.">
    <H>Our mission</H><P>We exist so that a learner in Turkana, a professional in Nairobi, and a founder in Mombasa all get the same quality of teaching, structure and proof of skill. Our tagline says it plainly: LEARN BEYOND LIMITS.</P>
    <H>How we work</H><UL items={["Every tutor is credential-verified before publishing.", "Students start free and are verified automatically when they register.", "Each premium course is bought independently with M-Pesa and then owned for life.", "Certificates are earned through completion and assessment, and anyone can verify them.", "Tutors earn the configured share of verified sales from their own courses."]} />
    <H>Built for Kenya, ready for the world</H><P>Elimu Bora is designed around Kenyan realities — mobile-first learning, M-Pesa payments, and content that speaks to local exams, careers and businesses — on architecture that scales internationally.</P>
  </StaticPage>;
}
