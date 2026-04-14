Shader "QuestMagnifier/MagnifyPassthrough"
{
    Properties
    {
        _MainTex ("Camera Texture", 2D) = "white" {}
        _ZoomLevel ("Zoom Level", Range(1, 8)) = 2.0
        _Brightness ("Brightness", Range(-1, 1)) = 0.0
        _Contrast ("Contrast", Range(-1, 1)) = 0.0
    }

    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Overlay" }
        LOD 100
        Cull Off
        ZWrite Off
        ZTest Always

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog

            #include "UnityCG.cginc"

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
            };

            struct v2f
            {
                float2 uv : TEXCOORD0;
                float4 vertex : SV_POSITION;
            };

            sampler2D _MainTex;
            float _ZoomLevel;
            float _Brightness;
            float _Contrast;

            v2f vert (appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = v.uv;
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                // Center UVs at (0.5, 0.5) and scale by zoom level
                float2 centeredUV = i.uv - 0.5;
                centeredUV /= _ZoomLevel;
                float2 zoomedUV = centeredUV + 0.5;

                // Clamp to prevent sampling outside texture bounds
                zoomedUV = saturate(zoomedUV);

                // Sample the camera texture
                fixed4 col = tex2D(_MainTex, zoomedUV);

                // Apply brightness: shift all channels
                col.rgb += _Brightness;

                // Apply contrast: scale around mid-gray (0.5)
                // contrast range -1..1 maps to multiplier 0..2
                float contrastFactor = 1.0 + _Contrast;
                col.rgb = (col.rgb - 0.5) * contrastFactor + 0.5;

                // Clamp final color
                col.rgb = saturate(col.rgb);
                col.a = 1.0;

                return col;
            }
            ENDCG
        }
    }

    FallBack "Unlit/Texture"
}
