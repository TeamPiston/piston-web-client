"use client";

import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header"; 
import { Check } from "lucide-react";

export default function RegisterTermsPage() {
  const [isChecked, setIsChecked] = useState(false);

  const handleNext = () => {
    if (!isChecked) return;
    // TODO: 다음 단계(정보 입력 페이지)로 이동하는 로직 추가
    console.log("다음 단계로 이동");
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden bg-white">
      {/* 상단 공통 헤더 */}
      <Header />

      {/* 중앙 메인 콘텐츠 영역 */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-[600px] bg-gray-50 border border-gray-100 p-7 rounded-sm text-sm leading-relaxed max-h-[488px] overflow-y-auto">
          <p>이용약관</p>
          
          <br></br>
          
          <p className="-mt-2">제 1 조 (목적)</p>
          
          <p>
            본 약관은 사용자가 플랫폼(이하 "피스톤")이 제공하는 AI 기반 3D 모델 자동 생성, 커뮤니티 아카이브 공유 및 3D 프린팅 자동 출력 서비스(이하 "서비스")를 이용함에 있어, 회사와 이용자의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
          </p>
          <br></br>
          
          <p className="-mt-2">제 2 조 (용어의 정의)</p>

          <p>
            피스톤 플랫폼:
            사용자의 자연어 입력 및 이미지를 기반으로 AI가 3D 모델을 생성·검증하고, 이를 3D 프린터(Bambu A1 Mini 등)로 자동 출력할 수 있도록 지원하는 통합 스마트 제조 플랫폼을 의미합니다.
          </p>
          <br></br>

          <p className="-mt-2">
            AI 채팅:
            GPT-4o 모델 등을 활용하여 사용자의 요구사항을 분석하고, 생활용품 생성 모드(OpenSCAD 기반) 또는 캐릭터/피규어 생성 모드(Text-to-3D, Image-to-3D)를 통해 3D 모델을 자동 생성하는 인터페이스를 의미합니다.
          </p>
          <br></br>

          <p className="-mt-2">
            아카이브(3D 파일 저장):
            사용자가 생성하거나 승인한 3D 파일을 플랫폼 내에 저장하여 본인 또는 다른 이용자가 출력할 수 있도록 공유하는 공간을 의미합니다.
          </p>
          <br></br>

          <p className="-mt-2">제 3 조 (회원가입 및 계정 관리)</p>
          <p>
            회원가입 절차:
            이용자는 이메일, 아이디, 비밀번호를 입력한 후, 해당 이메일로 발송된 숫자 6자리의 인증 번호를 입력하여 인증을 완료함으로써 회원가입을 진행합니다.
          </p>
          <br></br>

          <p className="-mt-2">
            계정 정보 회복:
            이용자가 아이디 또는 비밀번호를 분실한 경우, 가입한 이메일을 통해 아이디 확인 페이지 및 비밀번호 변경 페이지를 전송받아 계정 정보를 회복할 수 있습니다.
          </p>
          <br></br>

          <p className="-mt-2">
            마이페이지:
            회원은 마이페이지를 통해 본인의 개인정보 및 그동안 출력한 3D 모델 내역(출력 이력)을 확인할 수 있습니다.
          </p>
          <br></br>

          <p className="-mt-2">제 4 조 (서비스의 제공 및 핵심 기능)</p>
          <p>회사는 회원에게 다음과 같은 서비스를 제공합니다.</p>
          <br></br>

          <p className="-mt-2">
            3D 미리보기:
            AI가 생성한 3D 파일을 출력 전에 브라우저 상에서 미리 불러와 구조와 형태를 확인할 수 있습니다.
          </p>
          <br></br>

          <p className="-mt-2">
            3D 파일 저장 및 공유:
            생성된 3D 모델을 아카이브에 저장하여 다른 유저나 본인이 추후 다시 출력할 수 있도록 보관할 수 있습니다.
          </p>
          <br></br>

          <p className="-mt-2">
            출력 요청 및 자동 제어:
            회원이 3D 미리보기를 확인하고 최종 출력을 승인하면, 플랫폼이 이를 슬라이싱하여 지정된 3D 프린터로 신호를 보내 출력을 시작합니다.
          </p>
          <br></br>

          <p className="-mt-2">제 5 조 (데이터 및 이미지 업로드에 대한 책임)</p>
          <p>
            이용자는 AI 채팅 및 이미지 업로드 기능을 사용할 때, 타인의 저작권, 상표권, 초상권 등 일체의 지식재산권을 침해하는 파일이나 데이터(예: 저작권이 있는 캐릭터 사진, 도용된 디자인 등)를 제출해서는 안 됩니다.
          </p>
          <br></br>

          <p className="-mt-2">
            이용자가 업로드한 이미지 및 자연어 입력 데이터로 인해 제3자와의 사이에 법적 분쟁이 발생하는 경우, 그에 대한 모든 책임은 이용자 본인에게 있습니다.
          </p>
          <br></br>

          <p className="-mt-2">제 6 조 (AI 생성물 및 아카이브 저장 파일의 지식재산권)</p>
          <p>
            AI 생성물의 권리 관계:
            플랫폼의 AI(OpenSCAD 코드, Text-to-3D/Image-to-3D 메쉬)를 통해 자동 생성된 3D 모델의 권리 귀속 및 이용 범위는 관련 법령 및 AI 모델 제공사(OpenAI 등)의 정책을 따릅니다.
          </p>
          <br></br>

          <p className="-mt-2">
            아카이브 공유:
            이용자가 '3D 파일 저장' 기능을 통해 아카이브에 등록한 모델은 다른 유저가 조회하고 출력할 수 있도록 플랫폼 내에서 무상으로 라이선스가 부여된 것으로 간주합니다.
          </p>
          <br></br>

          <p className="-mt-2">제 7 조 (2단계 검증 시스템 및 출력 제한)</p>
          <p>
            회사는 안전하고 성공적인 프린팅을 위해 출력 전 2단계 검증 과정을 수행합니다.
          </p>
          <br></br>

          <p className="-mt-2">
            1차 검증 (규칙 기반):
            최소 벽 두께, 최소 바닥 두께, 최대 출력 크기(연결된 3D 프린터의 출력 가능 범위), 메쉬 오류 여부를 검사합니다.
            (예: 벽 두께 0.5mm 이하 등 기준 미달 시 출력 불가 판정)
          </p>
          <br></br>

          <p className="-mt-2">
            2차 검증 (AI 기반):
            무게 중심 불안정, 구조적 약점, 사용 목적 부적합성, 출력 실패 가능성을 분석하여 문제 발견 시 회원에게 수정 제안을 제공합니다.
          </p>
          <br></br>

          <p className="-mt-2">
            검증 시스템을 통과하지 못하거나, 총기류·도검류 등 무기류, 음란물, 기타 공공안전 및 미풍양속을 해치는 물품으로 판단되는 경우 회사는 출력을 거부하거나 취소할 수 있습니다.
          </p>
          <br></br>

          <p className="-mt-2">제 8 조 (면책 조항 - 3D 프린팅 특성 반영)</p>
          <p>
            재질 및 품질의 한계:
            3D 프린팅(FDM 방식 등) 특성상 적층 흔적, 거친 표면, 기후나 소재에 따른 미세한 치수 오차가 발생할 수 있으며, 회사는 실물 제품이 사용자의 주관적 기대치나 완벽한 기계적 정밀도와 일치하지 않는 것에 대해 책임을 지지 않습니다.
          </p>
          <br></br>

          <p className="-mt-2">
            기능적 약점:
            AI 기반 2차 검증을 거치더라도 실물 출력물의 강도, 내열성, 내구성 등은 사용 환경에 따라 다를 수 있으므로, 회사는 출력물의 구조적 결함으로 인해 발생한 2차 손해(물품 파손, 신체 상해 등)에 대해 책임을 지지 않습니다.
          </p>
          <br></br>

          <p className="-mt-2">
            서비스 중단:
            3D 프린터 장비의 하드웨어 고장, 필라멘트 소진, 노즐 막힘, 네트워크 슬라이싱 신호 전송 오류 등 기술적 결함으로 인해 출력이 지연되거나 실패할 수 있으며, 회사는 불가피한 장비 장애에 대해 신속한 재출력 또는 취소 절차를 제공하되 추가적인 손해배상 책임을 지지 않습니다.
          </p>
          <br></br>

          <p className="-mt-2">제 9 조 (관할 법원 및 기타)</p>
          <p>
            본 약관의 해석 및 회사와 이용자 간의 분쟁에 대해서는 대한민국 법령을 적용하며, 소송이 발생할 경우 회사의 본사 소재지를 관할하는 법원을 합의 관할 법원으로 합니다.
          </p>
          <br></br>

          <p>공고일자: 2026년 12월 27일</p>
          <p>시행일자: 2026년 12월 28일</p>
        </div>

        {/* 하단 동의 체크박스 및 다음 버튼 */}
        <div className="w-full max-w-[500px] mt-6 flex flex-col items-start">
          <label className="flex items-center gap-2 cursor-pointer select-none group">
            <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${
              isChecked ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white group-hover:border-gray-400"
            }`}>
              {isChecked && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={isChecked}
              onChange={(e) => setIsChecked(e.target.checked)}
            />
            <span className="text-sm text-gray-600 font-medium">이용 약관 동의</span>
          </label>

          <Link
            href="/register/form"
            onClick={(e) => { 
              if (!isChecked) e.preventDefault(); 
            }}
            className={`w-full h-12 mt-6 rounded-md font-semibold text-white flex items-center justify-center transition-all ${
              isChecked 
                ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md cursor-pointer" 
                : "bg-blue-300 cursor-not-allowed pointer-events-none" 
            }`}
          >
            다음
          </Link>
        </div>
      </main>
    </div>
  );
}