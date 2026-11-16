export function NuzzleLoadingMark() {
  return (
    <svg className="app-boot-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nuzzle-boot-background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--nuzzle-logo-bg-start, #79a98e)" />
          <stop offset="0.55" stopColor="var(--nuzzle-logo-bg-mid, #165e57)" />
          <stop offset="1" stopColor="var(--nuzzle-logo-bg-end, #064346)" />
        </linearGradient>
        <linearGradient id="nuzzle-boot-heart" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--nuzzle-logo-heart-start, #ff8b78)" />
          <stop offset="1" stopColor="var(--nuzzle-logo-heart-end, #ff6558)" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="56" fill="url(#nuzzle-boot-background)" />
      <path className="app-boot-upper" fill="var(--nuzzle-logo-upper, #f8ead9)" d="M49 104 C67 103 76 73 111 61 C145 49 174 63 194 85 C201 93 200 104 192 109 C185 114 180 109 173 103 C144 78 124 77 103 84 C80 91 65 105 49 104 Z" />
      <path className="app-boot-lower" fill="var(--nuzzle-logo-lower, #d7e7cb)" d="M60 139 C66 135 73 139 80 145 C106 169 123 174 142 169 C163 164 183 141 204 144 C189 145 179 156 166 168 C144 189 116 196 91 184 C76 177 63 164 59 152 C57 147 57 143 60 139 Z" />
      <path className="app-boot-heart" fill="url(#nuzzle-boot-heart)" d="M128 158 C119 149 98 131 98 116 C98 99 119 95 128 111 C137 95 158 99 158 116 C158 131 137 149 128 158 Z" />
    </svg>
  );
}
