require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoNativeWechat'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: 'https://github.com/evansuner/expo-wechat-lib' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'WechatOpenSDK', '~> 2.0.2'

  # Compiler flags
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17',
    'HEADER_SEARCH_PATHS' => '$(PODS_ROOT)/Headers/Public/React-Core'
  }

  s.source_files = 'ios/**/*.{h,m,mm,swift,hpp,cpp}'
  s.exclude_files = 'ios/**/.*'
end